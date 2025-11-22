# MSSQL 表结构是否足以直接实现 MongoDB 操作？

> 结论速览：仅提供 MSSQL 表结构（DDL）并不足以“直接”在 MongoDB 上完成等价操作。你还需要：数据语义与用例、主外键关系、约束/触发器逻辑、查询与更新模式、事务与并发需求、索引与性能目标、增量变化策略。得到这些后，才能设计恰当的 MongoDB 文档模型并编写迁移与操作代码。

## 1. 两种数据模型核心差异对比

| 维度 | SQL Server (关系型) | MongoDB (文档型) | 迁移/操作注意点 |
|------|--------------------|------------------|----------------|
| 数据结构 | 多表、规范化、JOIN | 嵌套文档、反规范化 | 识别哪些可以内嵌，哪些保持引用 |
| 主键 | 单列或复合（约束） | `_id` 任意类型（常用ObjectId） | 映射 identity/sequence -> `_id` |
| 关系 | 外键 | 没有强制外键 | 需要在应用层维护引用一致性 |
| 事务 | 多语句事务 (ACID) | 多文档事务（4.0+，成本高） | 尽量把强一致模型重新设计为单文档 |
| 索引 | B-Tree、多列复合 | 单字段/复合/TTL/文本等 | 审视查询模式避免全表扫描 |
| 约束 | CHECK/UNIQUE/FOREIGN KEY | Schema 可选（需 JSON Schema / 应用校验） | 逻辑约束迁移到写入代码或验证层 |
| 计算逻辑 | 触发器/存储过程 | 聚合管道、应用侧逻辑 | 将存储过程拆解为聚合 + 应用服务 |
| 查询模式 | JOIN + Group By | 单集合 + 聚合管道 `$lookup` | 频繁 JOIN 可转化为嵌套文档 |

## 2. 仅有表结构时缺失的关键信息

1. 使用场景（读多写多？实时查询还是离线分析？）  
2. 典型查询 WHERE / JOIN / 排序字段  
3. 更新模式：整体更新还是局部字段更新  
4. 约束与数据质量规则来源（触发器、存储过程）  
5. 历史归档/数据生命周期策略  
6. 安全与审计字段（谁创建、谁修改）  
7. 容量与增长（行数规模、每行大小、增长速率）  
8. 是否需要事务型一致性（跨表强一致 vs 最终一致）  

没有这些，容易出现：

- 文档嵌套过度导致写入冲突  
- 反规范化失控，冗余字段难以维护  
- 缺索引/错索引引发性能问题  
- 失去原先约束后数据质量下降  

## 3. 迁移/映射总体步骤

**步骤清单（Contract）：**

- 输入：MSSQL DDL、查询样本、业务用例、数据量估计  
- 输出：Mongo 集合 design 文档、字段映射表、索引定义、迁移脚本、校验与回滚方案  
- 错误模式：字段类型不兼容、嵌套层级过深、索引遗漏、ObjectId/引用断裂  
- 成功判定：功能等价（查询正确）、性能满足 SLA、数据校验通过、冗余策略明确  

**流程：**

1. 收集：抽取所有表结构 + 外键 + 索引 + 触发器 + 存储过程语义  
2. 分析：按用例标记“高频查询字段”与“必须强一致的关系”  
3. 分组：将经常一起 JOIN 且 1:N 或 N:1 的表尝试合并为文档嵌套；多对多保留引用集合  
4. 设计：产出集合列表、每个集合文档结构（必填/选填）， `_id` 生成策略  
5. 索引：主查询条件 + 排序字段 + 唯一性要求 -> Mongo 索引定义  
6. 约束迁移：CHECK/触发器逻辑转化为应用层校验或 Mongo 聚合写前检查  
7. 迁移脚本：批量读取 SQL -> 转换 -> 批量写入 Mongo；控制批次大小与并发  
8. 校验：行数比对、散列校验（可对关键字段生成 hash）  
9. 回滚策略：保留原始快照、失败时可重放  
10. 增量同步（可选）：变更捕获（CDC/时间戳）到 Mongo 增量写入  

## 4. 文档模型设计示例

假设有如下 SQL 结构：

```sql
CREATE TABLE Orders (
  OrderID BIGINT IDENTITY PRIMARY KEY,
  CustomerID BIGINT NOT NULL,
  OrderDate DATETIME2 NOT NULL,
  Status VARCHAR(20) NOT NULL
);

CREATE TABLE OrderItems (
  ItemID BIGINT IDENTITY PRIMARY KEY,
  OrderID BIGINT NOT NULL,
  ProductID BIGINT NOT NULL,
  Qty INT NOT NULL,
  UnitPrice DECIMAL(10,2) NOT NULL
);

CREATE TABLE Customers (
  CustomerID BIGINT IDENTITY PRIMARY KEY,
  Name NVARCHAR(200),
  Tier INT,
  Email VARCHAR(200)
);
```

### Mongo 文档示例（合并嵌套）

```json
{
  "_id": ObjectId("..."),
  "orderId": 12345,        // 保留原主键方便追溯
  "customer": {
    "customerId": 678,
    "name": "ACME",
    "tier": 2,
    "email": "c@acme.com"
  },
  "orderDate": ISODate("2025-11-18T08:00:00Z"),
  "status": "SHIPPED",
  "items": [
    { "productId": 111, "qty": 2, "unitPrice": 19.90 },
    { "productId": 222, "qty": 1, "unitPrice": 99.00 }
  ],
  "total": 138.80,
  "audit": { "createdAt": ISODate(), "source": "migration" }
}
```

### 索引设计建议

```js
// Node.js shell pseudo
// 1. 订单按客户+日期查询频繁
db.orders.createIndex({ "customer.customerId": 1, orderDate: -1 });
// 2. 状态过滤 + 日期范围
db.orders.createIndex({ status: 1, orderDate: -1 });
// 3. 唯一性（如果保留原 orderId）
db.orders.createIndex({ orderId: 1 }, { unique: true });
```

## 5. 类型与字段映射注意事项

| SQL 类型 | 常见映射 | 说明 |
|----------|----------|------|
| INT/BIGINT | Number | 若超过 JS 53 位精度可用 Decimal128 或字符串 |
| DECIMAL/NUMERIC | Decimal128 / String | 需精度运算时优先 Decimal128 |
| DATETIME/DATETIME2 | ISODate | 时区统一（UTC） |
| VARCHAR/NVARCHAR | String | 长度约束放应用层 |
| BIT | Boolean | 保持语义 |
| VARBINARY | BinData | 或转 Base64 String |
| UNIQUEIDENTIFIER | UUID String | 可直接作为 `_id` 或存字段 |

## 6. 约束与逻辑迁移

| 原机制 | Mongo 替代 |
|--------|-----------|
| FOREIGN KEY | 引用字段 + 应用层校验 + 后台一致性检查任务 |
| CHECK | 写入前校验（应用服务）或 Schema Validator |
| 触发器 | 改为应用事件 / Change Stream / 批处理任务 |
| 存储过程 | 拆为：聚合管道 + 应用逻辑函数 |
| 事务多表 | 文档整合 + 单集合操作；必要时使用多文档事务（谨慎） |

## 7. 迁移脚本示例（Node.js/Powershell 环境）

```js
// package.json 需包含: "mssql", "mongodb"
import sql from 'mssql';
import { MongoClient } from 'mongodb';

async function run() {
  const mssqlPool = await sql.connect({
    user: 'sa', password: '***', server: 'localhost', database: 'ERP', options: { encrypt: false }
  });
  const mongo = new MongoClient('mongodb://localhost:27017');
  await mongo.connect();
  const ordersCol = mongo.db('erp_mig').collection('orders');

  const orders = await mssqlPool.request().query(`
    SELECT o.OrderID, o.CustomerID, o.OrderDate, o.Status,
           c.Name AS CustomerName, c.Tier, c.Email,
           (SELECT ItemID, ProductID, Qty, UnitPrice FROM OrderItems i WHERE i.OrderID = o.OrderID FOR JSON PATH) AS ItemsJson
    FROM Orders o
    JOIN Customers c ON c.CustomerID = o.CustomerID
  `);

  const bulk = ordersCol.initializeUnorderedBulkOp();
  for (const row of orders.recordset) {
    const items = JSON.parse(row.ItemsJson || '[]');
    const total = items.reduce((s, it) => s + it.Qty * Number(it.UnitPrice), 0);
    bulk.find({ orderId: row.OrderID }).upsert().updateOne({
      $set: {
        orderId: row.OrderID,
        customer: {
          customerId: row.CustomerID,
          name: row.CustomerName,
          tier: row.Tier,
          email: row.Email
        },
        orderDate: new Date(row.OrderDate),
        status: row.Status,
        items: items.map(i => ({ productId: i.ProductID, qty: i.Qty, unitPrice: Number(i.UnitPrice) })),
        total,
        audit: { migratedAt: new Date(), source: 'initial-batch' }
      }
    });
  }
  await bulk.execute();
  console.log('Migration completed');
  await mongo.close();
}

run().catch(e => console.error(e));
```

**要点：**

- 使用 `FOR JSON PATH` 在 SQL Server 中快速生成嵌套 JSON  
- 批量操作减少往返  
- Upsert 保持幂等  
- 可分批：OFFSET/FETCH 或按主键范围  

## 8. 校验与质量

| 校验类型 | 方法 |
|----------|------|
| 行数 | `SELECT COUNT(*)` vs `db.orders.countDocuments()` |
| 总额字段 | 汇总比对（SQL SUM vs Mongo 聚合） |
| 散列校验 | 对关键字段拼接生成 hash，两个端比对 |
| 采样深度 | 随机抽样 1% 手工核对 |

## 9. 性能与索引策略

1. 优先基于查询模式设计索引，而非所有列复制  
2. 大数组字段避免过度增长（可拆子集合）  
3. 写入高并发场景避免巨大单文档频繁更新（热点拆分）  
4. 利用复合索引匹配前缀原则（customerId + orderDate）  
5. 定期使用 `db.collection.stats()` 与 `db.currentOp()` 分析  

## 10. 何时不建议直接迁移

| 场景 | 说明 |
|------|------|
| 复杂多表强事务 | 保持在关系型或改业务流程再迁移 |
| 重度依赖存储过程 | 需先剥离逻辑到应用服务层 |
| 多维分析/报表 | 考虑保留 OLAP / DW 方案，与 Mongo 分工 |

## 11. 增量同步策略（可选）

| 模式 | 说明 |
|------|------|
| 时间戳拉取 | 每次按 `LastUpdated > checkpoint` 抽取 |
| CDC/日志订阅 | 解析变更日志（可用第三方工具） |
| 触发器写入队列 | SQL 触发器推送到消息队列再消费 |

## 12. 常见陷阱与规避

| 陷阱 | 解决 |
|------|------|
| 文档过大 (>16MB) | 拆分集合，引用或分片 |
| 过度嵌套 | 降维：保留关键嵌套 + 子集合 |
| 丢失唯一约束 | 用唯一索引或应用层校验 |
| 冗余字段失同步 | 后台定期一致性校验任务 |
| 类型漂移 | 引入 Schema Validator + 单元测试 |

## 13. 快速清单（Checklist）

- [ ] 收集 DDL / 索引 / 外键 / 触发器 / 存储过程  
- [ ] 标注高频查询字段  
- [ ] 设计文档嵌套/引用分界  
- [ ] 定义 `_id` 与唯一索引  
- [ ] 约束迁移方案  
- [ ] 初始批迁移脚本 & 幂等  
- [ ] 数据校验与回滚策略  
- [ ] 增量同步机制（可选）  
- [ ] 监控与性能基线  

## 14. 后续扩展建议

1. 编写自动化转换器：解析 INFORMATION_SCHEMA 输出字段映射草稿  
2. 引入 JSON Schema 或 Zod/TypeScript 接口进行运行时校验  
3. 增量同步使用队列（Kafka / RabbitMQ）实现最终一致  
4. 加入单元 + 集成测试（Mock SQL 行与期望文档）  
5. 指标：迁移耗时、吞吐、失败重试率、文档大小分布  

## 15. 总结

仅凭 MSSQL 表结构并不能保证正确映射到 MongoDB；需要结合业务访问模式与约束逻辑重新进行文档建模。遵循“以查询模式驱动结构、以写入幂等保证迁移、以校验闭环保障质量”三原则，可实现平滑过渡。  

---
版本：2025-11-18
