const getResults = require("./getResults.service");
const endReview = require("./endReview.service");
const help = require("./help.service");
const welcome = require("./welcome.service");
const assignChecklist = require("./assignChecklist.service");
const saveEvent = require("./saveEvent.service");


module.exports = {
  welcome,
  help,
  assignChecklist,
  getResults,
  endReview,
  saveEvent,

};
