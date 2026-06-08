import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const rows = [
  {
    platform: "CardHobby",
    merchant: "CardHobby Demo Seller",
    order_no: "CH-DEMO-001",
    title: "Topps Chrome 足球卡合单",
    paid_at: "2026-06-01",
    item_amount: "520",
    shipping_amount: "18",
    total_amount: "538",
    source_link: "https://www.cardhobby.com.cn/",
    order_status: "paid",
    raw_text: "Topps Chrome 足球卡合单 商品金额 520 邮费 18"
  },
  {
    platform: "CardHobby",
    merchant: "CardHobby Demo Seller",
    order_no: "CH-DEMO-002",
    title: "Panini Prizm 限定卡",
    paid_at: "2026-06-02",
    item_amount: "300",
    shipping_amount: "12",
    total_amount: "312",
    source_link: "https://www.cardhobby.com.cn/",
    order_status: "paid",
    raw_text: "Panini Prizm 限定卡 商品金额 300 邮费 12"
  }
];

const columns = [
  "platform",
  "merchant",
  "order_no",
  "title",
  "paid_at",
  "item_amount",
  "shipping_amount",
  "total_amount",
  "source_link",
  "order_status",
  "raw_text"
];

function escapeCsv(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

const csv = [
  columns.join(","),
  ...rows.map((row) => columns.map((column) => escapeCsv(row[column])).join(","))
].join("\n");

const outputPath = join(__dirname, "output", "cardhobby-orders-sample.csv");
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${csv}\n`, "utf8");
console.log(outputPath);

