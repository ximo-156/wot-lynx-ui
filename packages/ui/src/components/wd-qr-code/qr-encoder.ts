/**
 * 历史编码入口的兼容 shim。
 *
 * wot-ui 2.3.2 的二维码编码由同目录 qrcode.ts 承担（完整 QR 编码器：Byte
 * 模式 / 版本 1-40 自适应 / L/M/Q/H 四级纠错 / Reed-Solomon / 掩码评估），
 * 组件本身也直接使用它。本文件仅保留库内早期的 `encodeQr(text)` 深度导入
 * 入口（ECC 固定 M 的历史行为），供既有消费方与回归测试使用。
 */
import { generateQRCode, QRErrorCorrectLevel } from './qrcode'

/**
 * 编码文本为 QR 模块矩阵（Byte 模式，ECC Level M）。
 * @returns { rows: boolean[][], size: number }
 */
export function encodeQr(text: string): { rows: boolean[][]; size: number } {
  const { modules, moduleCount } = generateQRCode(text, { errorCorrectLevel: QRErrorCorrectLevel.M })
  return { rows: modules, size: moduleCount }
}
