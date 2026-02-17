


![封面](./docs/docs/public/rin-logo.png)

[English](./README.md) | 简体中文

![GitHub commit activity](https://img.shields.io/github/commit-activity/w/openRin/Rin?style=for-the-badge)
![GitHub branch check runs](https://img.shields.io/github/check-runs/openRin/Rin/main?style=for-the-badge)
![GitHub top language](https://img.shields.io/github/languages/top/openRin/Rin?style=for-the-badge)
![GitHub License](https://img.shields.io/github/license/openRin/Rin?style=for-the-badge)
![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/openRin/Rin/deploy.yaml?style=for-the-badge)

## 项目简介

Rin 是一个基于 Cloudflare 开发者平台构建的现代化、无服务器博客系统，完全利用 Cloudflare Pages 托管、Workers 提供无服务器函数、D1 作为 SQLite 数据库、R2 进行对象存储。仅需一个指向 Cloudflare 的域名即可部署你的个人博客，无需服务器运维。

## 在线演示

https://xeu.life

## 功能特性
- **用户认证与管理**：支持 GitHub OAuth 登录。首个注册用户自动成为管理员，后续用户作为普通成员加入。
- **内容创作**：通过丰富的编辑器撰写和编辑文章。
- **实时自动保存**：本地草稿实时自动保存，不同文章之间互不干扰。
- **隐私控制**：可将文章标记为“仅自己可见”，用作私有草稿或个人笔记，并支持跨设备同步。
- **图片管理**：通过拖放或粘贴上传图片至兼容 S3 的存储（如 Cloudflare R2），并自动生成链接。
- **自定义别名**：为文章设置友好的 URL，例如 `https://yourblog.com/about`。
- **不公开文章**：可选择将文章隐藏于首页列表之外。
- **友情链接**：添加友博客链接，后端每 20 分钟自动检查链接可用性并更新状态。
- **评论系统**：支持回复评论，并具备评论删除管理功能。
- **Webhook 通知**：通过可配置的 Webhook 接收新评论的实时提醒。
- **特色图片**：自动识别文章内首张图片，并将其作为列表页的封面图展示。
- **标签解析**：输入如 `#博客 #Cloudflare` 的标签文本，自动解析并展示为标签。
- ……更多功能请访问 https://xeu.life 探索。

## 文档

### 快速开始

```bash
# 1. 克隆仓库
git clone https://github.com/openRin/Rin.git && cd Rin

# 2. 安装依赖
bun install

# 3. 配置环境变量
cp .env.example .env.local
# 编辑 .env.local 填入你的配置信息

# 4. 启动开发服务器
bun run dev
```

访问 http://localhost:5173 开始开发！

### Nix / Flake 快速开始

如果你使用 Nix，现在可以直接使用 flake 工作流：

```bash
# 1. 进入可复现开发环境（首次需接受仓库 flake 配置）
nix develop --accept-flake-config -c true

# 2. 启动本地开发
nix develop --accept-flake-config -c bun run dev

# 3. 运行完整 pre-commit 检查
nix develop --accept-flake-config -c pre-commit run --all-files

# 4. 使用 treefmt 格式化仓库
nix fmt
```

说明：
- Hook 定义仍以 `devenv.nix` 为唯一来源，并生成 `.devenv/pre-commit-config.yaml`。
- 仓库根目录的 `.pre-commit-config.yaml` 用于兼容 `pre-commit` 默认配置路径。
- 如果你的主机策略限制 IFD，可使用 `devenv shell --nix-option allow-import-from-derivation true`。

完整文档请访问 https://docs.openrin.org。

## 社区与支持

- 加入我们的 https://discord.gg/JWbSTHvAPN 参与讨论或获取帮助。
- 关注 https://t.me/openRin 频道获取最新动态。
- 发现 Bug 或有功能建议？欢迎在 GitHub 上提交 Issue。

## Star 历史

<a href="https://star-history.com/#openRin/Rin&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=openRin/Rin&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=openRin/Rin&type=Date" />
   <img alt="Star 历史图表" src="https://api.star-history.com/svg?repos=openRin/Rin&type=Date" />
 </picture>
</a>

## 参与贡献

我们欢迎各种形式的贡献——代码、文档、设计和想法。请查阅我们的贡献指南（即将添加），一起参与 Rin 的构建！

## License

```
Rin
Copyright (C) 2026  Bad3r

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
```
