// Mock for the qrcode package used in the founder dashboard
const QRCode = {
  toCanvas: jest.fn().mockResolvedValue(undefined),
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,mock'),
};

export default QRCode;
