"use strict";

const express = require("express");
const bodyParser = require("body-parser");
const expressWS = require("express-ws");
const JSZip = require("jszip");
const RandomString = require("randomstring");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const app = express();
app.use(bodyParser.raw({ limit: "10mb", type: "application/epub+zip" }));
expressWS(app);
const port = 8080;

for (let path of ["/mobi", "/pdf", "/docx"]) {
    app.ws(path, handleSocketRequest);
}

app.post(["/mobi", "/pdf", "/docx"], async (request, response) => {
    let zip = await JSZip.loadAsync(request.body);
    let file = await zip.file("ficlab.json");
    if (file === null) {
        return response.status(400).send("Invalid EPUB file");
    }
    let job = JSON.parse(await file.async("string"));
    console.log(`${job.settings.identity} ${job.settings.format}`);
    let prefix = RandomString.generate(7);
    let inputFile = `${prefix}.epub`;
    fs.writeFile(`/tmp/${inputFile}`, request.body, async err => {
        try {
            if (err) {
                throw err;
            }

            let output = await (async () => {
                switch (request.path) {
                    case "/mobi":
                        return toMOBI(job, inputFile);
                    case "/pdf":
                        return toPDF(job, inputFile);
                    case "/docx":
                        return toDOCX(job, inputFile);
                }
            })();
            response.set("Content-Type", output.type);
            response.sendFile(`/tmp/${output.file}`, null, err => {
                if (err) {
                    response.status(500).send("Error sending file");
                }
                fs.unlink(`/tmp/${output.file}`, () => {});
            });
        } catch (e) {
            response.status(500).send(`Transcode error: ${e.message}`);
        }

        fs.unlink(`/tmp/${inputFile}`, () => {});
    });
});

app.listen(port, () => {
    console.log(`Listening for transcode requests on port ${port}`);
});

function handleSocketRequest(ws, request) {
    ws.on("message", async message => {
        let buf = await Buffer.from(message);
        let zip = await JSZip.loadAsync(buf);
        let file = await zip.file("ficlab.json");
        if (file === null) {
            return ws.send("Invalid EPUB file");
        }
        let job = JSON.parse(await file.async("string"));
        console.log(`${job.settings.identity} ${job.settings.format}`);
        let prefix = RandomString.generate(7);
        let inputFile = `${prefix}.epub`;
        fs.writeFile(`/tmp/${inputFile}`, buf, async err => {
            try {
                if (err) {
                    throw err;
                }

                let output = await (async () => {
                    switch (request.path) {
                        case "/mobi/.websocket":
                            return toMOBI(job, inputFile);
                        case "/pdf/.websocket":
                            return toPDF(job, inputFile);
                        case "/docx/.websocket":
                            return toDOCX(job, inputFile);
                    }
                })();
                fs.readFile(`/tmp/${output.file}`, (err, data) => {
                    if (err) {
                        throw err;
                    }
                    ws.send(data);
                    ws.close();
                    fs.unlink(`/tmp/${output.file}`, () => {});
                });
            } catch (e) {
                ws.send(`Transcode error: ${e.message}`);
                ws.close();
            }

            fs.unlink(`/tmp/${inputFile}`, () => {});
        });
    });
}

function toMOBI(job, filename, workDir = "/tmp") {
    return new Promise((resolve, reject) => {
        let kindlegen = spawn("kindlegen", ["-o", `${filename}.mobi`, "-C0", filename], {
            cwd: workDir
        });
        kindlegen.on("close", status => {
            if (status > 0 && !job.settings.wantCover) {
                try {
                    fs.accessSync(`${filename}.mobi`);
                    status = 0;
                } catch (e) {
                    status = -1;
                }
            }
            if (status > 0) {
                reject(new Error(`Unable to convert file (code: ${status})`));
            } else {
                resolve({
                    type: "application/vnd.amazon.ebook",
                    file: `${filename}.mobi`
                });
            }
        });
        kindlegen.on("error", err => reject(err));
    });
}

function toPDF(job, filename, workDir = "/tmp") {
    return new Promise((resolve, reject) => {
        let fontSize = `${job.settings.fontSize * 20}`;
        let calibre = spawn(
            "ebook-convert",
            [
                filename,
                `${filename}.pdf`,
                "--pdf-page-numbers",
                "--pdf-add-toc",
                "--preserve-cover-aspect-ratio",
                "--custom-size",
                "6.93x9.24",
                "--pdf-default-font-size",
                fontSize,
                "--book-producer",
                "FicLab"
            ],
            { cwd: workDir }
        );
        calibre.on("close", status => {
            if (status > 0) {
                reject(`Unable to convert file (code: ${status})`);
            } else {
                resolve({
                    type: "application/pdf",
                    file: `${filename}.pdf`
                });
            }
        });
        calibre.on("error", err => reject(err));
    });
}

function toDOCX(job, filename, workDir = "/tmp") {
    return new Promise((resolve, reject) => {
        let fontSize = `${job.settings.fontSize * 20}`;
        let calibre = spawn(
            "ebook-convert",
            [
                filename,
                `${filename}.docx`,
                "--prefer-metadata-cover",
                "--chapter-mark=pagebreak",
                "--book-producer",
                "FicLab"
            ],
            { cwd: workDir }
        );
        calibre.on("close", status => {
            if (status > 0) {
                reject(`Unable to convert file (code: ${status})`);
            } else {
                resolve({
                    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    file: `${filename}.docx`
                });
            }
        });
        calibre.on("error", err => reject(err));
    });
}
