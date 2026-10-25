"use strict";

require("dotenv").config();

const {
  validateEnv,
} = require("./config/env");

validateEnv();

const app = require("./app");

app.set("trust proxy", true);

app.use((req, res, next) => {
  const host = (req.headers.host || "").toLowerCase();
  const forwardedProto = req.headers["x-forwarded-proto"];

  const isWww = host.startsWith("www.");
  const isHttp = forwardedProto === "http";

  if (isWww || isHttp) {
    const cleanHost = host.replace(/^www\./, "");
    return res.redirect(301, `https://${cleanHost}${req.originalUrl}`);
  }

  next();
});

const {
  testDatabaseConnection,
} = require("./config/db");


/*
|--------------------------------------------------------------------------
| PORT
|--------------------------------------------------------------------------
*/

const PORT = Number(
  process.env.PORT || 5000
);


/*
|--------------------------------------------------------------------------
| START SERVER
|--------------------------------------------------------------------------
*/

async function startServer() {
  try {

    /*
    |--------------------------------------------------------------------------
    | Test MySQL connection before starting the API
    |--------------------------------------------------------------------------
    */

    await testDatabaseConnection();


    /*
    |--------------------------------------------------------------------------
    | Start HTTP server
    |--------------------------------------------------------------------------
    */

    app.listen(
      PORT,
      "0.0.0.0",
      () => {
        console.log(
          `Business Playbook API running on port ${PORT}`
        );
      }
    );

  } catch (error) {

    console.error(
      "❌ MySQL connection failed:"
    );

    console.error(
      error.message
    );

    process.exit(1);
  }
}


/*
|--------------------------------------------------------------------------
| RUN
|--------------------------------------------------------------------------
*/

startServer();