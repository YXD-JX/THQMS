# PCB AOI-QMS 系统对接设计文档

## 1. 接口交互序列图
```mermaid
sequenceDiagram
    participant AOI设备
    participant QMS后端
    participant 数据库
    
    AOI设备->>QMS后端: POST /inspections (检测数据)
    QMS后端->>数据库: 保存原始数据
    数据库-->>QMS后端: 存储确认
    QMS后端->>AOI设备: 201 Created
    QMS后端->>数据库: 更新设备状态
    loop 每5分钟
        QMS后端->>AOI设备: GET /health-check
        AOI设备-->>QMS后端: 200 OK (含设备状态)
    end
```

**交互说明**：
1. 设备通过POST提交检测数据
2. 系统返回HTTP 201确认接收
3. 定时健康检查维持连接

## 2. 检测流程时序图
```mermaid
timingDiagram
    title 单次检测耗时分析
    section AOI设备
    图像采集  : 0ms-150ms
    缺陷分析  : 160ms-450ms
    数据打包  : 460ms-500ms

    section QMS系统
    网络传输  : 510ms-600ms
    数据校验  : 610ms-700ms
    数据库写入: 710ms-900ms
```

**关键指标**：
- 设备端处理耗时 ≤500ms
- 服务端处理耗时 ≤400ms

## 3. 系统流程图
```mermaid
flowchart TD
    A[开始检测] --> B{网络可用?}
    B -->|是| C[实时上传数据]
    B -->|否| D[本地存储数据]
    C --> E[接收分析结果]
    D --> F[定时重传机制]
    E & F --> G[生成检测报告]
```

## 4. 功能模块图
```mermaid
componentDiagram
    component 设备层 {
        相机控制
        光学检测
        数据采集
    }
    
    component 服务层 {
        API网关
        任务调度
        缺陷分析
    }
    
    component 存储层 {
        检测原始数据
        分析结果
        设备日志
    }
    
    设备层 -- HTTP/HTTPS --> 服务层
    服务层 -- MongoDB --> 存储层
```

## 5. 项目甘特图
```mermaid
gantt
    title 项目开发计划
    dateFormat  YYYY-MM-DD
    section 设备对接
    通信协议开发   :done, a1, 2023-08-01, 7d
    数据接口测试   :active, a2, 2023-08-09, 5d

    section 系统开发
    数据库设计     :crit, b1, 2023-08-01, 3d
    API核心开发    :crit, b2, 2023-08-04, 10d
    管理界面开发    : b3, 2023-08-14, 7d

    section 联调测试
    第一轮联调     :crit, after a2, 5d
    验收测试       : after b3, 5d
```

## 6. 设备状态图
```mermaid
stateDiagram-v2
    [*] --> 待机
    待机 --> 检测中: 启动指令
    检测中 --> 错误: 硬件故障
    检测中 --> 上传中: 完成检测
    上传中 --> 待机: 成功响应
    上传中 --> 重试中: 网络超时
    重试中 --> 上传中: 尝试恢复
    重试中 --> 离线: 超过3次失败
    离线 --> 上传中: 手动恢复
```

## 文档使用说明
1. 所有图表均采用标准Mermaid语法
2. 支持以下平台直接渲染：
   - GitHub/GitLab/Gitee的Markdown预览
   - VS Code + Mermaid插件
   - 各类支持Mermaid的Wiki系统
3. 修改建议：
   ```mermaid
   flowchart LR
       A[原始图表] --> B{修改点}
       B -->|调整参数| C[更新时间数值]
       B -->|增加节点| D[补充状态分支]
   ```

> **提示**：将本文件保存为`pcb-aoi-qms-design.md`后，可用浏览器或Markdown编辑器查看可视化图表。
