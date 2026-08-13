module.exports = {
  parseCombinedExcel: require('./combinedUploadParser').parseCombinedExcel,
  parsePaymentExcel: require('./excelParser').parsePaymentExcel,
  parsePaymentReceipts: require('./paymentParser').parsePaymentExcel,
};
