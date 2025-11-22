# THQMS_frontend 迁移到新电脑/其他电脑指南（Windows）

适用：拷贝到另一台电脑后弹“不可访问/权限不足/只读/被阻止”，或 dev 启动失败。

## 快速排障（目标电脑，项目根执行）

```powershell
# 1) 解除下载标记与只读
Get-ChildItem -Recurse | Unblock-File -ErrorAction SilentlyContinue
attrib -r /s /d .

# 2) 取得所有权并授予当前用户完全控制
try { takeown /F . /R /D Y } catch {}
icacls . /grant "$env:USERNAME:(OI)(CI)F" /T

# 3) 可选：路径过长支持（管理员 PowerShell 后重启）
# New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWord -Force
```

若仍“不可访问”，优先将项目放到短路径（如 C:\dev\THQMS\THQMS_frontend），避免桌面/文档/OneDrive 受控文件夹。

## 正确拷贝方式

- 首选 Git：源电脑提交推送；目标电脑 `git clone`。
- 必须手拷/压缩：
  1) 源电脑先删除 node_modules 与 dist（减小体积与深路径）。
  2) 压缩为 zip 再传输；目标电脑解压到本地短路径。
  3) 执行上面的“快速排障”。

可选：使用 Robocopy 复制且不带 ACL（在目标电脑执行）：
```powershell
robocopy <源路径> <目标路径> /MIR /COPY:DAT /DCOPY:DAT /R:1 /W:1 /NFL /NDL /NP
```

## 安装与运行

Node 要求：^20.19.0 或 >=22.12.0
```powershell
node -v
npm ci   # 如失败再用 npm install
npm run dev
```

若使用 HTTPS 开发证书，请按 `cert/README.md` 在目标机重新生成，并在 `.env.local` 填写新路径。

## 常见问题

- “来自其他计算机，已被阻止”：`Get-ChildItem -Recurse | Unblock-File`
- “访问被拒绝/不可访问”：`takeown ...` 后 `icacls ...`（见快速排障）
- “路径过长”：启用 LongPaths、放短路径
- npm/依赖安装异常：删除 node_modules 后重装；必要时管理员 PowerShell；开启 Windows 开发者模式以允许 symlink
