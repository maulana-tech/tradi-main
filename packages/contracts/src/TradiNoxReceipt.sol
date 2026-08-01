// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";

/// @title TradiNoxReceipt — On-chain ERC-721 receipt for PrivateOTC trades
/// @notice Each settled trade can be commemorated with an NFT receipt
/// minted to a participant's wallet. Metadata + SVG art are generated
/// fully on-chain so the keepsake outlives any off-chain image host.
/// @dev Mint is open by design — frontend gates UX to actual participants
/// (via Settled event log lookup). The on-chain `intentId` reference
/// keeps the audit trail intact regardless of who calls mint().
contract TradiNoxReceipt is ERC721 {
    using Strings for uint256;
    using Strings for uint8;

    enum Mode {
        Direct,
        RFQ
    }

    struct ReceiptData {
        uint256 intentId;
        Mode mode;
        bytes32 settleTxHash;
        // Display label for the asset pair, e.g. "cETH/cUSDC". Stored as
        // bytes32 to avoid dynamic-storage gas and keep mint cheap; the
        // expected vocabulary fits within 32 bytes for foreseeable demos.
        bytes32 pair;
        uint64 mintedAt;
        address minter;
    }

    uint256 public nextTokenId;
    mapping(uint256 => ReceiptData) public receipts;

    event ReceiptMinted(
        uint256 indexed tokenId,
        uint256 indexed intentId,
        address indexed minter,
        Mode mode
    );

    constructor() ERC721("Tradi-Nox OTC Receipt", "TRNOX") {}

    /// @notice Mint an on-chain receipt for a settled OTC trade. The
    /// caller becomes the owner. Multiple receipts per intent are
    /// allowed (e.g. maker and taker each mint their own copy).
    function mint(
        uint256 intentId,
        Mode mode,
        bytes32 settleTxHash,
        bytes32 pair
    ) external returns (uint256 tokenId) {
        tokenId = nextTokenId++;
        receipts[tokenId] = ReceiptData({
            intentId: intentId,
            mode: mode,
            settleTxHash: settleTxHash,
            pair: pair,
            mintedAt: uint64(block.timestamp),
            minter: msg.sender
        });
        _safeMint(msg.sender, tokenId);
        emit ReceiptMinted(tokenId, intentId, msg.sender, mode);
    }

    /// @notice Returns a fully-onchain `data:application/json;base64,...`
    /// URI containing JSON metadata + an inline SVG image.
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        ReceiptData memory r = receipts[tokenId];
        string memory pair = _trim32(r.pair);
        string memory modeStr = r.mode == Mode.Direct ? "Direct OTC" : "Vickrey RFQ";

        string memory svg = _buildSvg(tokenId, r, pair, modeStr);
        string memory json = _buildJson(tokenId, r, pair, modeStr, svg);
        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(bytes(json))));
    }

    function _buildJson(
        uint256 tokenId,
        ReceiptData memory r,
        string memory pair,
        string memory modeStr,
        string memory svg
    ) internal pure returns (string memory) {
        bytes memory header = abi.encodePacked(
            '{"name":"Tradi-Nox Receipt #',
            tokenId.toString(),
            '","description":"On-chain receipt for confidential OTC trade #',
            r.intentId.toString(),
            ' on PrivateOTC via iExec Nox.","image":"data:image/svg+xml;base64,',
            Base64.encode(bytes(svg)),
            '","attributes":['
        );
        bytes memory attrs = abi.encodePacked(
            '{"trait_type":"Mode","value":"',
            modeStr,
            '"},{"trait_type":"Pair","value":"',
            pair,
            '"},{"trait_type":"Intent ID","value":',
            r.intentId.toString(),
            ',"display_type":"number"},{"trait_type":"Settled At","display_type":"date","value":',
            uint256(r.mintedAt).toString(),
            "}]}"
        );
        return string(abi.encodePacked(header, attrs));
    }

    function _buildSvg(
        uint256 tokenId,
        ReceiptData memory r,
        string memory pair,
        string memory modeStr
    ) internal pure returns (string memory) {
        // Split chunks to avoid "stack too deep" — each abi.encodePacked
        // arg consumes a stack slot. Concatenating two halves keeps each
        // call within the 16-slot evm stack limit.
        bytes memory head = _svgHead(tokenId, pair);
        bytes memory body = _svgBody(r, modeStr);
        return string(abi.encodePacked(head, body));
    }

    function _svgHead(uint256 tokenId, string memory pair) internal pure returns (bytes memory) {
        bytes memory chrome = abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" font-family="ui-monospace,monospace">',
            '<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">',
            '<stop offset="0" stop-color="#0a0a0f"/><stop offset="1" stop-color="#1a0e2e"/>',
            "</linearGradient></defs>",
            '<rect width="512" height="512" fill="url(#bg)"/>',
            '<rect x="20" y="20" width="472" height="472" fill="none" stroke="#7c3aed" stroke-width="1.5"/>'
        );
        bytes memory header = abi.encodePacked(
            '<text x="40" y="60" fill="#7c3aed" font-size="11" letter-spacing="2">TRADI_NOX_RECEIPT</text>',
            '<text x="40" y="90" fill="#fafafa" font-size="34" font-weight="700">#',
            tokenId.toString(),
            "</text>",
            '<text x="40" y="160" fill="#a1a1aa" font-size="10" letter-spacing="2">PAIR</text>',
            '<text x="40" y="190" fill="#fafafa" font-size="22">',
            pair,
            "</text>"
        );
        return abi.encodePacked(chrome, header);
    }

    function _svgBody(ReceiptData memory r, string memory modeStr) internal pure returns (bytes memory) {
        bytes memory mid = abi.encodePacked(
            '<text x="40" y="240" fill="#a1a1aa" font-size="10" letter-spacing="2">MODE</text>',
            '<text x="40" y="266" fill="#7c3aed" font-size="16">',
            modeStr,
            "</text>",
            '<text x="40" y="316" fill="#a1a1aa" font-size="10" letter-spacing="2">INTENT</text>',
            '<text x="40" y="342" fill="#fafafa" font-size="16">#IX_',
            _padLeft(r.intentId.toString(), 4),
            "</text>"
        );
        bytes memory tail = abi.encodePacked(
            '<text x="40" y="392" fill="#a1a1aa" font-size="10" letter-spacing="2">SETTLE_TX</text>',
            '<text x="40" y="416" fill="#fafafa" font-size="13">',
            _shortHash(r.settleTxHash),
            "</text>",
            '<text x="40" y="470" fill="#52525b" font-size="9" letter-spacing="2">NOX_TEE \xc2\xb7 ARB_SEPOLIA</text>',
            "</svg>"
        );
        return abi.encodePacked(mid, tail);
    }

    function _trim32(bytes32 src) internal pure returns (string memory) {
        uint256 len;
        while (len < 32 && src[len] != 0) len++;
        bytes memory out = new bytes(len);
        for (uint256 i = 0; i < len; i++) out[i] = src[i];
        return string(out);
    }

    function _shortHash(bytes32 h) internal pure returns (string memory) {
        bytes16 hex16 = "0123456789abcdef";
        bytes memory s = new bytes(13); // 0x + 4 + ... + 4 = 0x1234…abcd → 0x1234..abcd
        s[0] = "0";
        s[1] = "x";
        for (uint256 i = 0; i < 4; i++) {
            s[2 + i * 2] = hex16[uint8(h[i] >> 4)];
            s[3 + i * 2] = hex16[uint8(h[i] & 0x0f)];
        }
        s[10] = ".";
        s[11] = ".";
        // last 1 byte
        s[12] = hex16[uint8(h[31] >> 4)];
        return string(s);
    }

    function _padLeft(string memory s, uint256 width) internal pure returns (string memory) {
        bytes memory b = bytes(s);
        if (b.length >= width) return s;
        bytes memory out = new bytes(width);
        uint256 pad = width - b.length;
        for (uint256 i = 0; i < pad; i++) out[i] = "0";
        for (uint256 i = 0; i < b.length; i++) out[pad + i] = b[i];
        return string(out);
    }
}
