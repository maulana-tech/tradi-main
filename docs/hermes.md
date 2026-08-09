# Menjalankan Hermes untuk Tradi

Dokumen ini adalah runbook Hermes. Status pekerjaan dan urutan migrasi ada di [migrasi.md](migrasi.md).

## Peran Hermes

Hermes adalah decision maker untuk RFQ. Ia membaca state, membandingkan price reference, lalu memilih:

- `skip`: tidak ada transaksi;
- `submit`: menyiapkan bid terenkripsi dan meminta KeeperHub mengeksekusi;
- `finalize`: meminta KeeperHub menyelesaikan RFQ yang memenuhi syarat.

Hermes tidak menyimpan private key eksekusi, tidak memanggil RPC write secara langsung, dan tidak boleh membuat transaction hash atau status sendiri.

## Prasyarat

- Hermes Agent sudah terpasang.
- Workspace KeeperHub memiliki organization API key berawalan `kh_` atau OAuth yang aktif.
- Wallet integration KeeperHub sudah dikonfigurasi.
- Contract dan cToken tersedia pada network testnet yang dipilih.
- Wallet bidder memiliki test token dan sudah mengizinkan `PrivateOTC` sebagai operator.
- Dependency repo sudah dipasang dengan `pnpm install`.

Gunakan Arbitrum Sepolia (`421614`) untuk konsisten dengan deployment Tradi, tetapi tetap verifikasi dukungannya melalui `list_action_schemas` saat setup.

## 1. Hubungkan KeeperHub MCP

Simpan secret di `~/.hermes/.env`, bukan di repo:

```env
KEEPERHUB_API_KEY=kh_replace_me
```

Tambahkan server remote ke `~/.hermes/config.yaml`:

```yaml
mcp_servers:
  keeperhub:
    url: "https://app.keeperhub.com/mcp"
    headers:
      Authorization: "Bearer ${KEEPERHUB_API_KEY}"
    tools:
      include:
        - tools_documentation
        - list_action_schemas
        - get_wallet_integration
        - execute_contract_call
        - get_direct_execution_status
```

Whitelist menjaga surface Hermes tetap kecil. Jangan mengaktifkan tool delete atau write lain yang tidak dibutuhkan demo.

Alternatif interaktif adalah OAuth:

```yaml
mcp_servers:
  keeperhub:
    url: "https://app.keeperhub.com/mcp"
    auth: oauth
```

Setelah mengubah konfigurasi, jalankan Hermes dari terminal baru lalu verifikasi tool:

```bash
hermes chat
```

Prompt pemeriksaan:

```text
Daftar tool MCP KeeperHub yang tersedia. Jangan menjalankan write.
```

Jika tool berubah, gunakan `tools_documentation` sebagai referensi runtime yang paling mutakhir.

## 2. Hubungkan MCP Tradi

Build server lokal:

```bash
pnpm --filter mcp-server build
```

Contoh konfigurasi stdio:

```yaml
mcp_servers:
  tradi_nox:
    command: "node"
    args:
      - "E:/smweb/tradi-main/packages/mcp-server/dist/index.js"
    env:
      AGENT_PRIVATE_KEY: "${TRADI_MCP_READONLY_PRIVATE_KEY}"
      ARBITRUM_SEPOLIA_RPC_URL: "${ARBITRUM_SEPOLIA_RPC_URL}"
      NEXT_PUBLIC_PRIVATE_OTC_ADDRESS: "${PRIVATE_OTC_ADDRESS}"
    tools:
      include:
        - private_otc_browse_intents
```

Path pada `args` harus diganti jika repo berada di lokasi lain. Simpan tiga nilai environment tersebut di `~/.hermes/.env`; jangan menulis nilainya langsung ke file konfigurasi atau repo.

Implementasi `getEnv()` saat ini masih meminta `AGENT_PRIVATE_KEY` bahkan untuk browse. Selama masa migrasi, gunakan key khusus tanpa dana untuk proses MCP read-only—bukan key wallet user atau wallet KeeperHub. Target akhirnya adalah memisahkan konfigurasi public client agar tool baca tidak membutuhkan private key sama sekali.

Saat ini hanya `private_otc_browse_intents` yang aman dipakai sebagai tool baca. Jangan expose `private_otc_keeperhub_relay`, karena implementasinya belum mengeksekusi KeeperHub. Setelah migrasi, whitelist dapat ditambah dengan tool read/prepare berikut:

```yaml
- private_otc_read_rfq_state
- private_otc_get_price_reference
- private_otc_prepare_encrypted_bid
- private_otc_explain_execution
```

Nama tool tambahan tersebut adalah kontrak target dan harus disesuaikan dengan nama yang benar-benar diimplementasikan.

## 3. Policy Hermes

Gunakan aturan ini pada system prompt atau skill RFQ Hermes:

```text
1. Baca state intent terbaru sebelum membuat keputusan.
2. Jangan menebak atau mencatat plaintext dari nilai terenkripsi.
3. Jangan gunakan private_otc_keeperhub_relay, viem.writeContract, atau raw RPC write.
4. Untuk write, panggil execute_contract_call dengan simulate=true terlebih dahulu.
5. Lanjutkan hanya jika success=true dan wouldRevert=false.
6. Broadcast sekali dengan idempotency key unik, lalu poll dengan batas waktu.
7. Revert dan input invalid adalah terminal; jangan retry buta.
8. Simpan decision reason dan seluruh evidence asli dari KeeperHub.
9. Jika bukti tidak lengkap, laporkan gagal; jangan membuat nilai pengganti.
```

Watcher Node tetap boleh mendeteksi `IntentCreated`, tetapi hanya satu writer yang aktif. Matikan write pada `market-maker` lama sebelum Hermes diberi izin broadcast.

## 4. Flow RFQ

```text
watcher menerima intentId
    -> Hermes membaca intent dan RFQ state
    -> Hermes mengambil price reference
    -> skip atau tentukan bid
    -> Nox menyiapkan encrypted calldata
    -> KeeperHub simulate
    -> KeeperHub execute
    -> poll status
    -> simpan audit
    -> web membaca audit
```

Untuk setiap action:

1. Pastikan intent masih berada pada state yang benar dan belum melewati deadline.
2. Pastikan sender KeeperHub adalah wallet yang memang memiliki aset dan permission.
3. Gunakan ABI typed dan encrypted arguments dari tool prepare, bukan hasil tebakan model.
4. Simulasikan dengan JSON boolean `true`, bukan string `"true"`.
5. Jangan mengharapkan tx hash dari simulasi karena tidak ada transaksi yang disiarkan.
6. Setelah simulasi lolos, broadcast dengan idempotency key unik.
7. Poll `get_direct_execution_status` sampai `completed` atau `failed`.

## 5. Bukti yang harus disimpan

Satu execution record harus berisi:

```json
{
  "intentId": "...",
  "action": "submitBid",
  "decision": "submit",
  "reason": "...",
  "executionId": "direct_...",
  "status": "completed",
  "transactionHash": "0x...",
  "transactionLink": "https://...",
  "gasUsed": "...",
  "sponsored": true,
  "error": null
}
```

Jangan mengisi field yang tidak diberikan KeeperHub dengan default seolah-olah data itu nyata.

## 6. Pilih mode transaksi dengan jujur

| Mode               | Kapan digunakan                                                     | Biaya gas                                           |
| ------------------ | ------------------------------------------------------------------- | --------------------------------------------------- |
| Public + sponsored | Demo zero-cost jika network, wallet, dan gas credit memenuhi syarat | Dapat disponsori; verifikasi `sponsored` pada hasil |
| Private + paid     | Saat private mempool dibutuhkan                                     | Tidak disponsori                                    |

Sponsorship tidak menyediakan token yang diperdagangkan. Gunakan faucet untuk aset testnet dan jangan mengklaim “zero-cost” sebelum status transaksi membuktikannya.

## 7. Troubleshooting

| Gejala                        | Pemeriksaan                                                           |
| ----------------------------- | --------------------------------------------------------------------- |
| `401`                         | API key salah, tidak ada, atau bukan organization key                 |
| Wallet tidak tersedia         | Periksa `get_wallet_integration` dan organization aktif               |
| Simulasi revert               | Periksa ABI, state RFQ, balance, allowance, dan operator permission   |
| Tidak ada tx hash             | Normal untuk simulasi; tx hash hanya ada setelah broadcast            |
| `sponsored: false`            | Periksa network, direct wallet sender, public routing, dan gas credit |
| Hermes tidak melihat tool     | Periksa whitelist, restart/reload MCP, lalu cek log Hermes            |
| Settlement `not operator`     | Kedua holder harus memanggil `setOperator(PrivateOTC, until)`         |
| Audit berubah setelah refresh | UI masih memakai data sintetis atau belum membaca storage persisten   |

## Checklist demo

- [ ] Hermes hanya melihat tool yang diperlukan.
- [ ] Satu writer aktif; tidak ada double-bid.
- [ ] Simulasi sukses direkam.
- [ ] Broadcast memakai idempotency key.
- [ ] Status terminal dan receipt tersimpan.
- [ ] Explorer link dapat dibuka.
- [ ] UI menampilkan bukti yang sama setelah refresh.
- [ ] Routing dan sponsorship sesuai hasil sebenarnya.

## Referensi resmi

- [Hermes MCP integration](https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp)
- [Use MCP with Hermes](https://hermes-agent.nousresearch.com/docs/guides/use-mcp-with-hermes)
- [KeeperHub MCP Server](https://docs.keeperhub.com/ai-tools/mcp-server)
- [KeeperHub Direct Execution API](https://docs.keeperhub.com/api/direct-execution)
- [KeeperHub Gas Management](https://docs.keeperhub.com/wallet-management/gas)
