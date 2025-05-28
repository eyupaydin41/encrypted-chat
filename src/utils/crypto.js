import CryptoJS from "crypto-js";

const secretKey = process.env.REACT_APP_SECRET_KEY;

export const encryptMessage = (text) => {
  return CryptoJS.AES.encrypt(text, secretKey).toString();
};

export const decryptMessage = (cipherText) => {
  const bytes = CryptoJS.AES.decrypt(cipherText, secretKey);
  return bytes.toString(CryptoJS.enc.Utf8);
};
