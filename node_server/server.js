const express = require("express");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");

const app = express();
const PORT = 3000;

app.use(bodyParser.json());

// 允许跨域访问（可选）
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    next();
});

// 指向前端 webapp 文件夹
app.use(express.static(path.join(__dirname, "../webapp")));

const historyFilePath = path.join(__dirname, "history.json");

// 获取历史记录
app.get("/api/getHistory", (req, res) => {
    fs.readFile(historyFilePath, "utf8", (err, data) => {
        if (err) return res.send([]);
        try {
            const aHistory = JSON.parse(data || "[]");
            res.send(aHistory);
        } catch (e) {
            res.send([]);
        }
    });
});

// 保存历史记录
app.post("/api/saveHistory", (req, res) => {
    const aHistory = req.body;
    fs.writeFile(historyFilePath, JSON.stringify(aHistory, null, 2), err => {
        if (err) return res.status(500).send("保存失败");
        res.send("保存成功");
    });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});