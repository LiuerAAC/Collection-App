# CardHobby Demo

这个目录用于独立验证 CardHobby 订单抓取，不作为主 App 的内置能力。

v0.1 先固定 CSV 输出格式，后续再替换为真实登录、翻页和抓取逻辑。

## CSV 字段

- platform
- merchant
- order_no
- title
- paid_at
- item_amount
- shipping_amount
- total_amount
- source_link
- order_status
- raw_text

## 生成示例数据

```bash
node scripts/cardhobby-demo/export-sample.mjs
```

输出文件：

```text
scripts/cardhobby-demo/output/cardhobby-orders-sample.csv
```

