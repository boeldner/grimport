const clock = document.getElementById('clock');
const deployTime = document.getElementById('deploy-time');

function tick() {
  clock.textContent = new Date().toLocaleTimeString();
}
tick();
setInterval(tick, 1000);

if (deployTime) {
  deployTime.textContent = 'loaded ' + new Date().toLocaleString();
}
