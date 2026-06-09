# Collection App

私人收藏管理 PWA，v0.1 聚焦 Web App 基础架构、本地优先数据和离线浏览。

## v0.1 范围

- 仓库藏品管理
- 卡牌默认字段模板
- 购买记录和售出记录关联
- 实体存放位置
- 基础卡册 Gallery
- 数据分析看板
- localStorage 持久化
- Service Worker 基础缓存

## 运行

```bash
npm install
npm run dev
```

默认开发地址：

```text
http://localhost:4173
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
