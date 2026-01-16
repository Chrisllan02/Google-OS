function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
      .setTitle('Workspace Dashboard')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}