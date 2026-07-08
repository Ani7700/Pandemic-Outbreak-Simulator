// Google Apps Script — receives survey responses and writes one row per submission.
// Deploy this on a Google Sheet (see SURVEY_SETUP.md), then paste the Web App URL
// into survey.html (the ENDPOINT constant).

function doPost(e){
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);                       // avoid two submissions colliding
  try{
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Responses") || ss.insertSheet("Responses");
    var data = JSON.parse(e.postData.contents);

    // header row: union of keys, in first-seen order, extended as new keys appear
    var headers = sheet.getRange(1,1,1,Math.max(1,sheet.getLastColumn())).getValues()[0];
    if(sheet.getLastRow() === 0 || headers.join("") === ""){
      headers = Object.keys(data);
      sheet.getRange(1,1,1,headers.length).setValues([headers]);
    } else {
      var added = false;
      Object.keys(data).forEach(function(k){
        if(headers.indexOf(k) === -1){ headers.push(k); added = true; }
      });
      if(added) sheet.getRange(1,1,1,headers.length).setValues([headers]);
    }

    var row = headers.map(function(h){ return data[h] != null ? data[h] : ""; });
    sheet.appendRow(row);
    return ContentService.createTextOutput("ok");
  } catch(err){
    return ContentService.createTextOutput("error: " + err);
  } finally {
    lock.releaseLock();
  }
}

function doGet(){ return ContentService.createTextOutput("Survey endpoint is live."); }
