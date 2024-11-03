const https = require("https");

exports.handler = async function (event, context) {
  const calendarUrl =
    "https://calendar.google.com/calendar/ical/92rldhsu09qgi7unrhjtq178no%40group.calendar.google.com/public/basic.ics"
    

  return new Promise((resolve, reject) => {
    https
      .get(calendarUrl, (res) => {
        let data = "";

        // A chunk of data has been received.
        res.on("data", (chunk) => {
          data += chunk;
        });

        // The whole response has been received.
        res.on("end", () => {
          resolve({
            statusCode: 200,
            headers: {
              "Content-Type": "text/html; charset=utf-8",
            },
            body: data,
          });
        });
      })
      .on("error", (e) => {
        reject({
          statusCode: 500,
          body: "Error: " + e.message,
        });
      });
  });
};
