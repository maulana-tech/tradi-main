Berikut adalah draf **Product Requirement Document (PRD) Integrasi Tradi × KeeperHub** yang sudah disesuaikan secara khusus agar **100% Zero-Cost (Tanpa Modal)**, siap dieksekusi oleh developer maupun AI Agent (seperti Claude Code, Cursor, atau AutoGPT).

---

# 📄 Product Requirement Document (PRD)

## **1. Document Overview & Objective**

* **Project Name:** Tradi (TradiNox)


* **Target Event:** KeeperHub Hackathon (July 27 – August 13, 2026)
* **Objective:** Mengintegrasikan *Execution & Reliability Layer* **KeeperHub** ke dalam *Private OTC Agent System* milik **Tradi**, serta memenangkan Grand Prize dan Bounty UX.
* **Core Constraint (Strict Rule):** **100% Zero-Cost Testing Strategy**. Seluruh pengembangan, integrasi, dan pengujian *onchain* wajib menggunakan *Testnet Tokens* (Faucet) dan *Gas Sponsorship* tanpa mengeluarkan modal uang sepeser pun.

---

## **2. Cost & Environment Architecture (Zero-Cost Policy)**

Untuk menjamin testing berjalan tanpa modal, arsitektur testing dibagi menjadi 3 tingkatan (*tiers*):

```
+-------------------------------------------------------------------+
|                     1. Local Chain (Anvil)                        |
|   - Saldo ETH buatan tak terbatas & eksekusi instan tanpa biaya   |
+-------------------------------------------------------------------+
                                  │
                                  ▼
+-------------------------------------------------------------------+
|               2. Testnet Environment (Sepolia)                    |
|   - Token transaksi didapat gratis via Tradi Faucet (`/faucet`)   |
+-------------------------------------------------------------------+
                                  │
                                  ▼
+-------------------------------------------------------------------+
|             3. KeeperHub Mainnet / Sponsored Layer                |
|   - Transaksi disponsori via KeeperHub Gas Sponsorship             |
+-------------------------------------------------------------------+

```

### **Spesifikasi Zero-Cost Tools:**

1. **Local Network Testing:** Menggunakan Foundry Anvil (`packages/contracts`) untuk mensimulasikan smart contract `PrivateOTC.sol` secara lokal.


2. **Testnet Token Faucet:** Menggunakan modul faucet bawaan Tradi di `packages/web/app/faucet/page.tsx` untuk meminjam/mendapatkan test token gratis.


3. **Execution Sponsorship:** Memanfaatkan **KeeperHub Gas Sponsorship** dan **x402/MPP Agentic Wallet** untuk menutup seluruh biaya gas fee transaksi agent.

---

## **3. Functional Requirements**

### **3.1. Re-Routing Agent Execution Layer (Core Requirement)**

* **Requirement:** Seluruh bot AI di `packages/agents` (seperti *RFQ Sweeper* dan *Market Maker*) DILARANG melakukan transaksi *onchain* langsung via RPC/Viem bawaan.


* **Implementation:**
* Alirkan *payload* transaksi melalui **KeeperHub MCP Server** (`/ai-tools/mcp-server`).
* Gunakan **KeeperHub Smart Gas Estimation** (dengan *exponential backoff*) untuk menghindari transaksi macet.
* Aktifkan **Private Routing** untuk proteksi MEV pada transaksi OTC privat.



### **3.2. Observability & Audit Log Display**

* **Requirement:** Aplikasi web `packages/web` harus dapat menampilkan rekam jejak eksekusi agent yang diproses oleh KeeperHub.


* **Implementation:**
* Tangkap respons *Audit Trail* dari KeeperHub (Trigger, Simulation Result, Tx Hash, Gas Used, Timestamp).
* Tampilkan log ini pada komponen UI `ActivityFeed.tsx` dan halaman `/history`.





### **3.3. Bounty Deliverables ($1,000 UX/Onboarding Bounty)**

* **Requirement:** Menyediakan jalur *onboarding* super cepat bagi developer lain yang ingin mencoba KeeperHub dari nol sampai transaksi pertama.
* **Implementation:**
1. **Starter Kit Template:** Rapikan repo menjadi template *plug-and-play* yang dapat dijalankan kurang dari 2 menit.
2. **Zero-Cost Onboarding Guide:** Tulis dokumen `docs/KEEPERHUB-STARTER-TUTORIAL.md` yang memandu penggunaan Faucet + KeeperHub Gas Sponsorship.
3. **Teardown & Merged PR:** Catat *friction points* saat pengujian, buat file `KEEPERHUB-TEARDOWN.md`, dan submit Pull Request perbaikan ke repo open-source KeeperHub.



---

## **4. Technical Implementation Steps for AI Agents**

AI Agent pembangun (misal: Cursor / Claude) wajib mengikuti urutan langkah eksekusi berikut:

```
[Step 1: Audit]  ──> Periksa file transaksi di `packages/agents/src/`
[Step 2: Config] ──> Inject KEEPERHUB_CONFIG & Gas Sponsorship flag
[Step 3: Wrapper]──> Buat `KeeperHubExecutor` di `packages/agents/src/keeperhub-executor.ts`
[Step 4: Reroute]──> Ganti `walletClient.writeContract` ke KeeperHub MCP Call
[Step 5: Test]   ──> Jalankan tes via Sepolia Faucet / Anvil secara GRATIS
[Step 6: Doc]    ──> Buat dokumen Teardown & Tutorial Onboarding

```

---

## **5. Acceptance Criteria & Hackathon Submission Checklist**

* [ ] **Working Agent Execution:** Agent berhasil membuat *decision* dan mengeksekusi transaksi pada smart contract `PrivateOTC.sol` melalui KeeperHub Execution Layer.


* [ ] **Proof of Transaction:** Terdapat minimal 1 *Onchain Transaction Hash* yang tervalidasi diproses oleh KeeperHub (dilampirkan di BUIDL submission).
* [ ] **Zero Modal Spent:** Seluruh pengujian terbukti menggunakan Testnet / Faucet / Gas Sponsorship.
* [ ] **Observability:** Dashboard Tradi menampilkan *Audit Log* asli dari transaksi KeeperHub.


* [ ] **Bounty Submision:** PR perbaikan ke repo KeeperHub terkirim & dokumen `KEEPERHUB-TEARDOWN.md` tersedia di root repository.