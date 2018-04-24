# Sci Chicken

A PUBG pcap playback system that does not hog CPU/GPU, works with version 3.7.28.9.

## Sniff

You need an extra computer to be the man in the middle, to ensure your safety. I personally use MacOS, but Linux or windows should work as well.

Suppose your gaming pc is `192.168.0.200`, and your middle machine. is `192.168.0.100`, first, set the network gateway to `192.168.0.100` on your gaming windows machine.

Then, enable forwarding and nat on your middle machine. Here is how I do on MacOS:

```bash
sudo sysctl -w net.inet.ip.forwarding=1
# my network interface is en5
echo "nat on en5 inet from 192.168.0.0/24 to any -> 192.168.0.100" | sudo pfctl -v -ef -
```

For linux, I believe it is something like:

```bash
sudo sysctl -w net.inet.ip.forwarding=1
sudo iptables -t nat --append POSTROUTING --out-interface eth0 -j MASQUERADE
```

For windows, I don't know. But I believe it will not be hard to do so.

Your gaming pc should be able to connect to internet now. Open your game, enter lobby.

Now, run this project on your middle machine:

```bash
# enter the project dir
npm i
# optional, if you want to see prettier log
npm i -g pino
# run. my network interface is en5
node index.js sniff en5 192.168.0.200 | pino
```

Open the browser, and start the game, hope you can win. The good thing about web UI is, you can share the link to your team members. Check out ngrok or localtunnel.

## Playback

If your gaming pc's IP is 192.168.0.200, then capture the packets with bpf `(src host 192.168.0.200 and udp dst portrange 7000-7999) or (dst host 192.168.0.200 and udp src portrange 7000-7999)` and save the file as `xxxx.pcap`. You can use wireshark or tcpdump to do this.

Then we can playback the session:

```bash
node index.js playback '/yourdir/xxx.pcap'
```

The session will be in paused state, check out the API in `./backend/api.js`. You can use playback API to control it.

For example, if you want to fast forward to a certain point, call the API with this payload:

```json
{
  "action" : "start",
  "speed": "20000.0",
  "restart": "true",
  "eventCount": "44000"
}
```

This can be helpful when you want to tune the UI.

## Testing scripts

When I need to debug the parsing logic, I use this script, very handy:

```bash
LOGLEVEL=warn node test-getcmd-pcapfile.js '/yourdir/yourpcapfile.pcap'
```

## UI tuning

Current UI is in Chinese, it should be pretty straightforward to change to any language.

Once you have the correct data in gamestate.js, the rest work like UI stuff is all easy shit. This project uses openlayers v4 to draw the map UI. You can use a pcapfile with playback mode, fast forward to a point, and then adjust UI elements.

Check out the `npm run fedev` script, it will auto refresh the UI when you change app.js.

## Contribution

There must be some bugs in the current version. But please don't send pull requests to me since I will no longer maintain this project. Fork and enjoy yourself!
