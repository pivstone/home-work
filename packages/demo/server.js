const http = require('node:http');
const net = require('node:net');

const port = parseInt(process.env.HTTP_PORT ?? '3000', 10);
const serverIp = process.env.POD_IP ?? 'unknown';

const server = http.createServer(function (req, res) {
  try {
    console.log(req.headers);
    res.writeHead(200, { server_ip: serverIp });
    res.write(serverIp);
    res.end();
  } catch (err) {
    console.error(err);
    res.end();
  }
});

server.listen(port, () => {
  console.log(`Creating a server at ${serverIp}:${port}...`);
});
