# Collection App

私人收藏管理 PWA，用于管理多品类藏品、订单、图片资产、Gallery 展示和统计分析。

当前项目已经从早期 `localStorage` 原型推进到本地优先、IndexedDB、Supabase 登录/同步、图片暂存与上传的方向；同时，因网络端数据稳定性仍需继续验证，当前实际数据会先存储在 Obsidian vault：

```text
/Users/yuxuancao/Library/Mobile Documents/iCloud~md~obsidian/Documents/Life
```

下一阶段会把这个 vault 作为可信本地数据源，增加一个 Obsidian 数据导入/上传端口，把 vault 中的藏品、订单、图纸来源、图片与待入库数据解析后同步到网页 Dataset。

## 当前产品线

- Web App / PWA：日常管理、Gallery、数据分析、账号与云同步。
- Obsidian Vault：本地先行存储、批量图片待入库、订单和藏品双链、Base 浏览与仪表盘统计。
- Dataset：网页端的结构化数据空间，后续承接 Obsidian 导入、MARD 拼豆库和用量统计。

## 已完成核心能力

- 仓库藏品管理
- 多品类字段模板
- 购买记录和售出记录
- 藏品、订单、售出记录关联
- 实体存放位置
- 基础卡册 Gallery
- 数据分析看板
- IndexedDB 本地持久化
- Supabase Auth / Snapshot 同步 / Storage 图片上传方案
- PWA Service Worker 基础缓存
- JSON 备份导出

## 本次文档目标

本轮先不改代码，只更新产品和开发文档，明确下一次实现目标：

1. 从 Obsidian vault 读取全部相关数据。
2. 提取匹配数据并上传到网页 Dataset。
3. Dataset 新增 MARD 221 色拼豆库。
4. 支持按 `全部 / A / B / C / D / E / F / G / H / M` 色号组筛选。
5. 每个色号支持点击加号补库存，一次增加 `1000` 颗。
6. 拼豆图纸识别后统计色号消耗，并从豆库库存扣减。
7. 数据分析中新增色号使用排行。

详见：

- [产品需求文档_PRD.md](/Users/yuxuancao/Documents/Collection_app/产品需求文档_PRD.md)
- [开发文档_v0.1.md](/Users/yuxuancao/Documents/Collection_app/开发文档_v0.1.md)
- [存储与同步方案_v0.2.md](/Users/yuxuancao/Documents/Collection_app/存储与同步方案_v0.2.md)
- [迭代记录_2026-06-13.md](/Users/yuxuancao/Documents/Collection_app/docs/迭代记录_2026-06-13.md)
- [本次更新目标_v0.4.md](/Users/yuxuancao/Documents/Collection_app/docs/本次更新目标_v0.4.md)

## 运行

```bash
npm install
npm run dev
```

默认开发地址：

```text
http://localhost:5173
```

## 构建

```bash
npm run build
npm run preview
```

## 项目结构

```text
public/
  manifest.webmanifest
  sw.js
src/
  App.tsx
  components/
  data/
  screens/
  store/
  styles.css
```
