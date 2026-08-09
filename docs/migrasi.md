# Migrasi Tradi ke Hermes + KeeperHub

Dokumen ini adalah sumber kebenaran untuk migrasi jalur transaksi agent Tradi. Panduan menjalankan Hermes ada di [hermes.md](hermes.md).

## Ringkasan

Status integrasi saat ini: **belum siap disebut terintegrasi penuh**.

Target akhirnya adalah:

> Hermes mengambil keputusan; Nox menjaga nilai tetap terenkripsi; KeeperHub menyimulasikan dan mengirim transaksi; `PrivateOTC` menyelesaikan trade; web menampilkan bukti eksekusi yang asli.

Fokus pertama hanya satu alur RFQ yang hidup dari awal sampai akhir. Jangan menambah banyak alur sebelum satu transaksi testnet dapat dibuktikan melalui KeeperHub.

## Pembagian tanggung jawab

| Bagian                | Tanggung jawab                                                   |
| --------------------- | ---------------------------------------------------------------- |
| Hermes                | Membaca konteks dan memilih `skip`, `submit`, atau `finalize`    |
| Nox                   | Mengenkripsi amount/bid dan mengatur permission encrypted handle |
| KeeperHub             | Preflight, eksekusi, retry, status, dan audit transaksi          |
| `PrivateOTC`          | RFQ, escrow, operator permission, dan settlement atomik          |
| `packages/mcp-server` | Tool domain Tradi untuk read dan prepare calldata            |
| Web                   | Menampilkan status dan bukti dari data persisten                 |

Hermes bukan wallet atau relayer. KeeperHub tidak menentukan strategi harga. Web bukan sumber kebenaran transaksi.

## Kondisi kode sekarang

| Area                                              | Kondisi sekarang                                                      | Kondisi yang dituju                                                          |
| ------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `packages/agents/src/keeperhub-executor.ts`       | Mengirim ke endpoint `/relay` custom dan dapat fallback ke Viem       | Memakai KeeperHub MCP/API resmi; tidak ada fallback saat mode wajib aktif    |
| `packages/mcp-server/src/tools/keeperhubRelay.ts` | Hanya mengembalikan metadata tanpa mengeksekusi transaksi             | Dihapus atau diganti adapter yang meneruskan hasil KeeperHub asli            |
| `packages/web/lib/hooks/useKeeperHubAudit.ts`     | Membuat hash, gas, dan status dari `intentId`                         | Membaca audit record persisten dari backend/KeeperHub                        |
| Hermes                                            | Belum ada konfigurasi dan policy di repo                              | Menjadi satu-satunya pengambil keputusan RFQ                                 |
| Bukti                                             | Belum ada execution ID KeeperHub yang dapat dicocokkan dengan receipt | Execution ID, tx hash/link, receipt, gas, sponsorship, dan outcome tersimpan |

Hash atau status sintetis boleh dipakai di unit test, tetapi tidak boleh tampil sebagai transaksi nyata pada demo atau submission.

## Arsitektur target

```text
IntentCreated
    -> watcher deterministik
    -> Hermes membaca state dan price reference
    -> Hermes memilih skip atau bid
    -> Nox menyiapkan encrypted calldata
    -> KeeperHub simulate
    -> KeeperHub execute dengan idempotency key
    -> poll sampai completed/failed
    -> simpan audit asli
    -> web menampilkan tx link dan recovery action
```

Jangan menjalankan Hermes dan `market-maker` lama sebagai dua penulis transaksi. Selama migrasi, pilih salah satu writer melalui konfigurasi agar tidak terjadi double-bid.

## Urutan migrasi

### 1. Buktikan satu write resmi

- Hubungkan KeeperHub MCP di Hermes sesuai [hermes.md](hermes.md).
- Gunakan `list_action_schemas` untuk memverifikasi chain dan schema yang tersedia.
- Pastikan wallet integration KeeperHub sudah aktif.
- Pilih satu fungsi paling sederhana, disarankan `submitBid` pada Arbitrum Sepolia.
- Jalankan `execute_contract_call` dengan `simulate: true`.
- Jika simulasi sukses dan `wouldRevert` bernilai `false`, kirim argumen yang sama dengan idempotency key unik.
- Poll `get_direct_execution_status` sampai `completed` atau `failed`.

Jangan lanjut ke UI sebelum langkah ini menghasilkan `executionId` dan transaksi testnet yang dapat dibuka di explorer.

### 2. Buat satu shared executor

Shared executor harus menangani alur berikut:

```text
prepare -> simulate -> execute once -> bounded poll -> persist
```

Data minimum yang disimpan:

```text
intentId
action
decision + reason
executionId
status
transactionHash
transactionLink
gasUsed
sponsored
createdAt
completedAt
error
```

Aturan error:

- Revert, ABI salah, balance kurang, dan operator belum aktif adalah terminal; jangan retry buta.
- Retry hanya untuk error sementara seperti timeout, rate limit, atau server error.
- Backoff harus memiliki batas percobaan dan batas waktu.
- Idempotency key harus stabil untuk satu intent dan action agar retry tidak mengirim transaksi ganda.

### 3. Batasi MCP Tradi ke read/prepare

Tool domain yang dibutuhkan:

```text
read_public_intent(intentId)
read_rfq_state(intentId)
get_price_reference(base, quote)
prepare_encrypted_bid(intentId, amount)
explain_execution(executionId)
```

Nama di atas adalah target API, bukan klaim bahwa semuanya sudah tersedia. Tool prepare boleh mengembalikan calldata terenkripsi, tetapi write final tetap melalui KeeperHub.

### 4. Pindahkan keputusan ke Hermes

- Watcher tetap deterministik dan hanya menjadi trigger.
- Hermes selalu membaca state terbaru sebelum mengambil keputusan.
- Nonaktifkan write path `market-maker` dan `rfq-sweeper` lama setelah pengganti Hermes lolos uji.
- Mode produksi/hackathon harus gagal tertutup jika KeeperHub tidak tersedia; direct Viem hanya boleh untuk local development dan harus terlihat jelas di log.

### 5. Ganti audit sintetis

- Persist hasil KeeperHub di backend/server-side storage.
- Web membaca record tersebut berdasarkan `intentId` atau `executionId`.
- Tampilkan `transactionLink` sebagai bukti utama.
- Tampilkan state `simulating`, `submitted`, `confirming`, `success`, dan `failed`.
- Setiap failure memiliki satu recovery action yang jelas.

## Aturan biaya dan routing

“Zero-cost” bukan flag aplikasi. Klaim tersebut hanya benar jika hasil KeeperHub untuk transaksi tertentu menyatakan `sponsored: true`.

Menurut dokumentasi KeeperHub, sponsorship memerlukan network yang didukung, direct wallet sender, public mempool, dan gas credit yang masih tersedia. Private routing tidak disponsori. Karena itu gunakan dua mode yang jujur:

- `public + sponsored`: untuk demo tanpa biaya gas jika seluruh syarat terpenuhi.
- `private + paid`: untuk private routing; wallet membayar gas.

Faucet hanya menyediakan aset testnet. Sponsorship hanya menutup gas, bukan aset yang diperdagangkan.

## Prasyarat settlement

Sebelum `acceptIntent` atau `revealRFQWinner`, kedua holder harus mengizinkan `PrivateOTC` sebagai operator pada cToken yang relevan. Tanpa `setOperator(PrivateOTC, until)`, settlement akan revert.

Wallet yang terpasang di KeeperHub juga harus menjadi akun bidder yang benar, memiliki test token yang dibutuhkan, dan sudah memberi operator permission. Jangan memasukkan private key wallet tersebut ke browser atau prompt Hermes.

## Verifikasi

Jalankan pemeriksaan minimum setelah implementasi:

```bash
pnpm --filter agents test
pnpm --filter agents exec tsc --noEmit
pnpm --filter mcp-server test
pnpm --filter mcp-server exec tsc --noEmit
pnpm --filter web test
pnpm --filter web type-check
```

Uji manual wajib mencakup:

- simulasi sukses lalu transaksi sukses;
- simulasi revert tanpa broadcast;
- operator belum aktif;
- KeeperHub tidak tersedia saat mode wajib aktif;
- polling timeout;
- refresh halaman tetap menampilkan audit yang sama;
- retry tidak membuat transaksi ganda.

## Definition of done

Migrasi selesai hanya jika semuanya benar:

- Ada minimal satu transaksi Arbitrum Sepolia nyata melalui KeeperHub.
- `executionId`, tx hash/link, receipt, gas, sponsorship, dan outcome dapat dicocokkan.
- Tidak ada hash, gas, status, atau klaim MEV sintetis di UI produksi.
- Tidak ada write path Hermes/agent yang melewati KeeperHub saat mode wajib aktif.
- Encrypted calldata dan operator authorization tetap kompatibel dengan contract.
- Failure dan recovery dapat didemokan, bukan hanya happy path.
- README dan submission menyebut network, sender, routing mode, dan sponsorship secara jujur.

## Referensi resmi

- [KeeperHub MCP Server](https://docs.keeperhub.com/ai-tools/mcp-server)
- [KeeperHub Direct Execution API](https://docs.keeperhub.com/api/direct-execution)
- [KeeperHub Gas Management](https://docs.keeperhub.com/wallet-management/gas)
- [Hermes MCP integration](https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp)
