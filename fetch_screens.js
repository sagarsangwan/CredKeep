const fs = require('fs');
const https = require('https');
const path = require('path');

const screens = [
  { name: "Record Payment", url: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY1ZDY1MTJjMmM3OWQwN2M0ZDc3ZGI2MGMzY2UyEgsSBxDs876tiw8YAZIBIwoKcHJvamVjdF9pZBIVQhM4MTA2NjY3OTAxODY4MjI3ODE1&filename=&opi=89354086" },
  { name: "Payment Recorded", url: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY1ZDY1MTM3Yjk0OGYwOTEwNGY3MGU2MGNlZjQzEgsSBxDs876tiw8YAZIBIwoKcHJvamVjdF9pZBIVQhM4MTA2NjY3OTAxODY4MjI3ODE1&filename=&opi=89354086" },
  { name: "New Loan - Security", url: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY1ZDY0ZTcwZDIzMWQwMmE5YjgzYzI5MmMzZWE1EgsSBxDs876tiw8YAZIBIwoKcHJvamVjdF9pZBIVQhM4MTA2NjY3OTAxODY4MjI3ODE1&filename=&opi=89354086" },
  { name: "CredKeep - Collections", url: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY1ZDY0YzgxYzljMzQwMWE2MGJmNTA0MmFkODgzEgsSBxDs876tiw8YAZIBIwoKcHJvamVjdF9pZBIVQhM4MTA2NjY3OTAxODY4MjI3ODE1&filename=&opi=89354086" },
  { name: "CredKeep - Home", url: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY1ZDY0Yzg2NGQzNWQwMWVlNjkyMzA2MWJkNGJjEgsSBxDs876tiw8YAZIBIwoKcHJvamVjdF9pZBIVQhM4MTA2NjY3OTAxODY4MjI3ODE1&filename=&opi=89354086" },
  { name: "New Loan - Borrower & Product", url: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY1ZDY0ZTY0YmZiOGIwMmE5OWZhOGZkMTIzMGI3EgsSBxDs876tiw8YAZIBIwoKcHJvamVjdF9pZBIVQhM4MTA2NjY3OTAxODY4MjI3ODE1&filename=&opi=89354086" },
  { name: "New Loan - Terms & Calculation", url: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY1ZDY1MGU4OTMyNWYwMWVlNjY5ZmJlMTE0MjU3EgsSBxDs876tiw8YAZIBIwoKcHJvamVjdF9pZBIVQhM4MTA2NjY3OTAxODY4MjI3ODE1&filename=&opi=89354086" },
  { name: "CredKeep - More Settings", url: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY1ZDY0YzhkMTU4YjEwMjJkNTc1NjlkMTljMWNjEgsSBxDs876tiw8YAZIBIwoKcHJvamVjdF9pZBIVQhM4MTA2NjY3OTAxODY4MjI3ODE1&filename=&opi=89354086" },
  { name: "CredKeep - Loans", url: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY1ZDY0Yzg0MzFjNDMwMWE2M2U1NTkyMDJjZDk4EgsSBxDs876tiw8YAZIBIwoKcHJvamVjdF9pZBIVQhM4MTA2NjY3OTAxODY4MjI3ODE1&filename=&opi=89354086" },
  { name: "CredKeep - Borrowers", url: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY1ZDY0YzgyYjI2NmIwNzc5YTA1ZjhhMWU3ZTNjEgsSBxDs876tiw8YAZIBIwoKcHJvamVjdF9pZBIVQhM4MTA2NjY3OTAxODY4MjI3ODE1&filename=&opi=89354086" },
  { name: "New Loan - Review & Create", url: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY1ZDY1MTA0ZTY3ZTkwOTI1YzdlMWEyMWYzY2VhEgsSBxDs876tiw8YAZIBIwoKcHJvamVjdF9pZBIVQhM4MTA2NjY3OTAxODY4MjI3ODE1&filename=&opi=89354086" }
];

const dir = path.join(__dirname, '.scratch', 'screens');
if (!fs.existsSync(dir)){
    fs.mkdirSync(dir, { recursive: true });
}

screens.forEach(screen => {
  const filename = Object.values(screen.name.split(' - ')).join('_').replace(/ /g, '_') + '.html';
  const file = fs.createWriteStream(path.join(dir, filename));
  https.get(screen.url, function(response) {
    response.pipe(file);
  });
});
