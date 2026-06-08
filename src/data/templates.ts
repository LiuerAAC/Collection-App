import { Category, CustomField, Tag } from "../types";

export const defaultCategories: Category[] = [
  { id: "cat-card", name: "卡牌", icon: "CARD", sortOrder: 1 },
  { id: "cat-badge", name: "徽章", icon: "PIN", sortOrder: 2 },
  { id: "cat-bead", name: "拼豆", icon: "BEAD", sortOrder: 3 },
  { id: "cat-handmade", name: "手工制品", icon: "HAND", sortOrder: 4 }
];

export const defaultTags: Tag[] = [
  { id: "tag-football", name: "足球", color: "#2F7D6D" },
  { id: "tag-limited", name: "限定", color: "#B8892D" },
  { id: "tag-auto", name: "签字", color: "#356EA8" },
  { id: "tag-favorite", name: "重点收藏", color: "#B5534B" }
];

export const cardFieldTemplate: CustomField[] = [
  { id: "field-card-company", categoryId: "cat-card", name: "卡牌公司", type: "single", options: ["Topps", "Panini", "Futera", "Leaf"], sortOrder: 1 },
  { id: "field-card-series", categoryId: "cat-card", name: "系列", type: "text", sortOrder: 2 },
  { id: "field-card-year", categoryId: "cat-card", name: "年份", type: "text", sortOrder: 3 },
  { id: "field-card-player", categoryId: "cat-card", name: "球员名称", type: "text", required: true, sortOrder: 4 },
  { id: "field-card-club", categoryId: "cat-card", name: "俱乐部", type: "text", sortOrder: 5 },
  { id: "field-card-country", categoryId: "cat-card", name: "国家队", type: "text", sortOrder: 6 },
  { id: "field-card-number", categoryId: "cat-card", name: "卡牌编号", type: "text", sortOrder: 7 },
  { id: "field-card-refractor", categoryId: "cat-card", name: "折射类型", type: "single", options: ["Base", "Refractor", "Prizm", "Mojo", "Gold", "Other"], sortOrder: 8 },
  { id: "field-card-limited", categoryId: "cat-card", name: "限定编号", type: "text", sortOrder: 9 },
  { id: "field-card-auto", categoryId: "cat-card", name: "是否签字", type: "boolean", sortOrder: 10 },
  { id: "field-card-relic", categoryId: "cat-card", name: "是否物料", type: "boolean", sortOrder: 11 },
  { id: "field-card-grade", categoryId: "cat-card", name: "品相/评级", type: "text", sortOrder: 12 }
];

export const badgeFieldTemplate: CustomField[] = [
  { id: "field-badge-theme", categoryId: "cat-badge", name: "主题", type: "text", sortOrder: 1 },
  { id: "field-badge-craft", categoryId: "cat-badge", name: "工艺", type: "single", options: ["烤漆", "滴胶", "珐琅", "金属"], sortOrder: 2 },
  { id: "field-badge-size", categoryId: "cat-badge", name: "尺寸", type: "text", sortOrder: 3 }
];

export const beadFieldTemplate: CustomField[] = [
  { id: "field-bead-theme", categoryId: "cat-bead", name: "作品主题", type: "text", sortOrder: 1 },
  { id: "field-bead-method", categoryId: "cat-bead", name: "烫法", type: "single", options: ["单面", "双面", "轻烫", "重烫"], sortOrder: 2 },
  { id: "field-bead-size", categoryId: "cat-bead", name: "尺寸", type: "text", sortOrder: 3 }
];

export const defaultFields: CustomField[] = [
  ...cardFieldTemplate,
  ...badgeFieldTemplate,
  ...beadFieldTemplate
];

