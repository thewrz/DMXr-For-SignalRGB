Item {
    anchors.fill: parent

    // Manual fallback config (kept for when mDNS doesn't work)
    property string serverHost: service.getSetting("DMXr", "serverHost") || "127.0.0.1"
    property string serverPort: service.getSetting("DMXr", "serverPort") || "8080"

    // Multi-server state
    property var serverList: []              // Array of server objects from registry
    property int discoveredServerCount: 0
    property var healthData: ({})            // healthData[serverId] = { health, fixtures }

    // Manual connection test state
    property string manualTestStatus: ""     // "", "connected", "error"

    Flickable {
        anchors.fill: parent
        contentHeight: mainColumn.height + 40
        clip: true

        ScrollBar.vertical: ScrollBar {
            anchors.right: parent.right
            width: 10
            visible: true
            policy: ScrollBar.AsNeeded
            contentItem: Rectangle {
                radius: parent.width / 2
                color: theme.scrollBar
            }
        }

        Column {
            id: mainColumn
            width: parent.width
            padding: 20
            spacing: 16

            // --- Header ---
            Text {
                text: "DMXr Configuration"
                color: theme.primarytextcolor
                font.family: "Poppins"
                font.weight: Font.Bold
                font.pixelSize: 22
            }

            Text {
                text: "DMX lighting fixtures synced with SignalRGB via DMXr servers."
                color: theme.primarytextcolor
                font.family: "Poppins"
                font.pixelSize: 13
                opacity: 0.7
                width: parent.width - 40
                wrapMode: Text.WordWrap
            }

            // --- Divider ---
            Rectangle {
                width: parent.width - 40
                height: 1
                color: "#444444"
            }

            // --- Servers Section Header ---
            Text {
                text: "Servers"
                color: theme.primarytextcolor
                font.family: "Poppins"
                font.weight: Font.Bold
                font.pixelSize: 16
            }

            Text {
                text: discoveredServerCount > 0
                    ? discoveredServerCount + " server" + (discoveredServerCount !== 1 ? "s" : "") + " discovered"
                    : "No servers discovered yet"
                color: discoveredServerCount > 0 ? "#88ff88" : theme.primarytextcolor
                font.family: "Poppins"
                font.pixelSize: 12
                opacity: discoveredServerCount > 0 ? 0.8 : 0.5
            }

            // --- Server Cards ---
            Repeater {
                model: serverList

                Rectangle {
                    id: serverCard
                    width: mainColumn.width - 40
                    height: serverCardColumn.height + 20
                    radius: 4
                    color: "#1a1a24"
                    border.color: getServerBorderColor(modelData)
                    border.width: 2

                    // Left accent bar
                    Rectangle {
                        x: 0
                        y: 0
                        width: 4
                        height: parent.height
                        radius: 2
                        color: getServerBorderColor(modelData)
                    }

                    Column {
                        id: serverCardColumn
                        x: 16
                        y: 10
                        width: parent.width - 32
                        spacing: 8

                        // Server name + status dot + host:port
                        Row {
                            spacing: 8
                            width: parent.width

                            Rectangle {
                                width: 10
                                height: 10
                                radius: width / 2
                                anchors.verticalCenter: parent.verticalCenter
                                color: getServerBorderColor(modelData)
                            }

                            Text {
                                text: getServerDisplayName(modelData)
                                color: theme.primarytextcolor
                                font.family: "Poppins"
                                font.weight: Font.Bold
                                font.pixelSize: 14
                                anchors.verticalCenter: parent.verticalCenter
                            }

                            Text {
                                text: modelData.host + ":" + modelData.port
                                color: theme.primarytextcolor
                                font.family: "Poppins"
                                font.pixelSize: 12
                                opacity: 0.5
                                anchors.verticalCenter: parent.verticalCenter
                            }
                        }

                        // DMX hardware status line
                        Text {
                            text: getDmxStatusText(modelData)
                            color: getDmxStatusColor(modelData)
                            font.family: "Poppins"
                            font.pixelSize: 12
                            width: parent.width
                            wrapMode: Text.WordWrap
                        }

                        // Fixture count + version
                        Row {
                            spacing: 16

                            Text {
                                text: getFixtureCountText(modelData)
                                color: theme.primarytextcolor
                                font.family: "Poppins"
                                font.pixelSize: 12
                                opacity: 0.6
                            }

                            Text {
                                visible: getServerVersion(modelData) !== ""
                                text: "v" + getServerVersion(modelData)
                                color: theme.primarytextcolor
                                font.family: "Poppins"
                                font.pixelSize: 12
                                opacity: 0.4
                            }
                        }

                        // Reconnect attempts (if reconnecting)
                        Text {
                            visible: getReconnectAttempts(modelData) > 0
                            text: "Reconnect attempt " + getReconnectAttempts(modelData) + "..."
                            color: "#ffd060"
                            font.family: "Poppins"
                            font.pixelSize: 11
                            opacity: 0.7
                        }

                        // Error details (if disconnected/reconnecting)
                        Text {
                            visible: getErrorSuggestion(modelData) !== ""
                            text: getErrorSuggestion(modelData)
                            color: theme.primarytextcolor
                            font.family: "Poppins"
                            font.pixelSize: 11
                            opacity: 0.6
                            width: parent.width
                            wrapMode: Text.WordWrap
                        }

                        // Open Web Manager button
                        Row {
                            spacing: 8

                            Item {
                                visible: modelData.healthy !== false
                                width: 140
                                height: 26

                                Rectangle {
                                    anchors.fill: parent
                                    color: "#6a3d9a"
                                    radius: 2
                                }

                                ToolButton {
                                    width: parent.width
                                    height: parent.height
                                    font.family: "Poppins"
                                    font.bold: true
                                    font.pixelSize: 11
                                    text: "Open Web Manager"

                                    onClicked: {
                                        Qt.openUrlExternally("http://" + modelData.host + ":" + modelData.port);
                                    }

                                    contentItem: Text {
                                        text: parent.text
                                        color: "#ffffff"
                                        font: parent.font
                                        horizontalAlignment: Text.AlignHCenter
                                        verticalAlignment: Text.AlignVCenter
                                    }

                                    background: Item {}
                                }
                            }
                        }

                        // --- Nested Fixture Cards ---
                        Repeater {
                            model: getServerFixtures(modelData)

                            Rectangle {
                                width: serverCardColumn.width
                                height: fixtureCardContent.height + 14
                                radius: 3
                                color: "#141e2a"
                                border.color: "#1e2e3e"
                                border.width: 1

                                Column {
                                    id: fixtureCardContent
                                    x: 12
                                    y: 7
                                    spacing: 2

                                    Text {
                                        text: modelData.name || "Unknown"
                                        color: theme.primarytextcolor
                                        font.family: "Poppins"
                                        font.weight: Font.Bold
                                        font.pixelSize: 12
                                    }

                                    Row {
                                        spacing: 12

                                        Text {
                                            text: "DMX " + (modelData.dmxStartAddress || "?")
                                            color: theme.primarytextcolor
                                            font.family: "Poppins"
                                            font.pixelSize: 11
                                            opacity: 0.5
                                        }

                                        Text {
                                            text: (modelData.channelCount || "?") + " ch"
                                            color: theme.primarytextcolor
                                            font.family: "Poppins"
                                            font.pixelSize: 11
                                            opacity: 0.5
                                        }

                                        Text {
                                            text: modelData.manufacturer || ""
                                            color: theme.primarytextcolor
                                            font.family: "Poppins"
                                            font.pixelSize: 11
                                            opacity: 0.5
                                            visible: text !== ""
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // --- No Servers Found Guide ---
            Column {
                visible: discoveredServerCount === 0
                width: parent.width - 40
                spacing: 10

                Rectangle {
                    width: parent.width
                    height: noServersContent.height + 24
                    radius: 4
                    color: "#1a1a2a"
                    border.color: "#4060a0"
                    border.width: 1

                    Column {
                        id: noServersContent
                        x: 16
                        y: 12
                        width: parent.width - 32
                        spacing: 8

                        Text {
                            text: "Getting Started with DMXr"
                            color: "#8888ff"
                            font.family: "Poppins"
                            font.weight: Font.Bold
                            font.pixelSize: 14
                        }

                        Text {
                            text: "No DMXr servers were discovered on your network. Servers are found automatically via mDNS, or you can add one manually below."
                            color: theme.primarytextcolor
                            font.family: "Poppins"
                            font.pixelSize: 12
                            opacity: 0.8
                            width: parent.width
                            wrapMode: Text.WordWrap
                        }

                        Text {
                            text: "1. Download DMXr Server from the latest release"
                            color: theme.primarytextcolor
                            font.family: "Poppins"
                            font.pixelSize: 12
                            opacity: 0.8
                            width: parent.width
                            wrapMode: Text.WordWrap
                        }

                        Row {
                            spacing: 12

                            Item {
                                width: 170
                                height: 28

                                Rectangle {
                                    anchors.fill: parent
                                    color: "#009000"
                                    radius: 2
                                }

                                ToolButton {
                                    width: parent.width
                                    height: parent.height
                                    font.family: "Poppins"
                                    font.bold: true
                                    font.pixelSize: 11
                                    text: "Download DMXr Server"

                                    onClicked: {
                                        Qt.openUrlExternally("https://github.com/thewrz/DMXr/releases/latest");
                                    }

                                    contentItem: Text {
                                        text: parent.text
                                        color: "#ffffff"
                                        font: parent.font
                                        horizontalAlignment: Text.AlignHCenter
                                        verticalAlignment: Text.AlignVCenter
                                    }

                                    background: Item {}
                                }
                            }
                        }

                        Text {
                            text: "2. Extract the zip and double-click DMXr-Server.bat"
                            color: theme.primarytextcolor
                            font.family: "Poppins"
                            font.pixelSize: 12
                            opacity: 0.8
                            width: parent.width
                            wrapMode: Text.WordWrap
                        }

                        Text {
                            text: "3. The server should appear here automatically.\n    If not, use Manual Server Connection below."
                            color: theme.primarytextcolor
                            font.family: "Poppins"
                            font.pixelSize: 12
                            opacity: 0.8
                            width: parent.width
                            wrapMode: Text.WordWrap
                        }

                        Rectangle {
                            width: parent.width
                            height: 1
                            color: "#444444"
                        }

                        Text {
                            text: "Troubleshooting"
                            color: theme.primarytextcolor
                            font.family: "Poppins"
                            font.weight: Font.Bold
                            font.pixelSize: 12
                            opacity: 0.7
                        }

                        Text {
                            text: "- Windows: install Bonjour (Apple) or iTunes for mDNS support\n- Firewall: allow UDP port 5353 (mDNS) and TCP port 8080\n- Different subnet? Use Manual Server Connection below"
                            color: theme.primarytextcolor
                            font.family: "Poppins"
                            font.pixelSize: 11
                            opacity: 0.6
                            width: parent.width
                            wrapMode: Text.WordWrap
                        }
                    }
                }
            }

            // --- Divider ---
            Rectangle {
                width: parent.width - 40
                height: 1
                color: "#444444"
            }

            // --- Manual Server Connection (fallback) ---
            Text {
                text: "Manual Server Connection"
                color: theme.primarytextcolor
                font.family: "Poppins"
                font.weight: Font.Bold
                font.pixelSize: 16
            }

            Text {
                text: "Use this if mDNS discovery doesn't find your server (e.g. different subnet, VM, no Bonjour)."
                color: theme.primarytextcolor
                font.family: "Poppins"
                font.pixelSize: 12
                opacity: 0.5
                width: parent.width - 40
                wrapMode: Text.WordWrap
            }

            Row {
                spacing: 12

                // Host input
                Column {
                    spacing: 4

                    Text {
                        text: "Host"
                        color: theme.primarytextcolor
                        font.family: "Poppins"
                        font.pixelSize: 12
                        opacity: 0.7
                    }

                    Rectangle {
                        width: 200
                        height: 32
                        radius: 2
                        border.color: "#444444"
                        border.width: 2
                        color: "#141414"

                        TextField {
                            id: hostInput
                            width: 180
                            leftPadding: 0
                            rightPadding: 10
                            x: 10
                            y: -4
                            color: theme.primarytextcolor
                            font.family: "Poppins"
                            font.bold: true
                            font.pixelSize: 14
                            verticalAlignment: TextInput.AlignVCenter
                            placeholderText: "127.0.0.1"
                            text: serverHost

                            validator: RegularExpressionValidator {
                                regularExpression: /^((?:[0-1]?[0-9]?[0-9]|2[0-4][0-9]|25[0-5])\.){0,3}(?:[0-1]?[0-9]?[0-9]|2[0-4][0-9]|25[0-5])$/
                            }

                            background: Item {
                                width: parent.width
                                height: parent.height
                                Rectangle {
                                    color: "transparent"
                                    height: 1
                                    width: parent.width
                                    anchors.bottom: parent.bottom
                                }
                            }

                            onTextEdited: {
                                serverHost = text;
                                service.saveSetting("DMXr", "serverHost", text);
                            }
                        }
                    }
                }

                // Port input
                Column {
                    spacing: 4

                    Text {
                        text: "Port"
                        color: theme.primarytextcolor
                        font.family: "Poppins"
                        font.pixelSize: 12
                        opacity: 0.7
                    }

                    Rectangle {
                        width: 80
                        height: 32
                        radius: 2
                        border.color: "#444444"
                        border.width: 2
                        color: "#141414"

                        TextField {
                            id: portInput
                            width: 60
                            leftPadding: 0
                            rightPadding: 10
                            x: 10
                            y: -4
                            color: theme.primarytextcolor
                            font.family: "Poppins"
                            font.bold: true
                            font.pixelSize: 14
                            verticalAlignment: TextInput.AlignVCenter
                            placeholderText: "8080"
                            text: serverPort

                            validator: IntValidator {
                                bottom: 1024
                                top: 65535
                            }

                            background: Item {
                                width: parent.width
                                height: parent.height
                                Rectangle {
                                    color: "transparent"
                                    height: 1
                                    width: parent.width
                                    anchors.bottom: parent.bottom
                                }
                            }

                            onTextEdited: {
                                serverPort = text;
                                service.saveSetting("DMXr", "serverPort", text);
                            }
                        }
                    }
                }
            }

            // Test Connection button + status
            Row {
                spacing: 12
                height: 32

                Item {
                    width: 130
                    height: 30

                    Rectangle {
                        anchors.fill: parent
                        color: "#009000"
                        radius: 2
                    }

                    ToolButton {
                        width: parent.width
                        height: parent.height
                        anchors.verticalCenter: parent.verticalCenter
                        font.family: "Poppins"
                        font.bold: true
                        font.pixelSize: 12
                        text: "Test Connection"

                        onClicked: {
                            testManualConnection();
                        }

                        contentItem: Text {
                            text: parent.text
                            color: "#ffffff"
                            font: parent.font
                            horizontalAlignment: Text.AlignHCenter
                            verticalAlignment: Text.AlignVCenter
                        }

                        background: Item {}
                    }
                }

                Rectangle {
                    visible: manualTestStatus !== ""
                    width: 10
                    height: 10
                    radius: width / 2
                    anchors.verticalCenter: parent.verticalCenter
                    color: manualTestStatus === "connected" ? "#209e20"
                         : manualTestStatus === "error" ? "#c03030"
                         : "#606060"
                }

                Text {
                    visible: manualTestStatus !== ""
                    text: manualTestStatus === "connected" ? "Reachable — will appear in server list"
                        : manualTestStatus === "error" ? "Connection failed"
                        : ""
                    color: theme.primarytextcolor
                    font.family: "Poppins"
                    font.pixelSize: 12
                    anchors.verticalCenter: parent.verticalCenter
                    opacity: 0.7
                }
            }
        }
    }

    // --- Poll timer: refresh server registry + health every 3s ---
    Timer {
        interval: 3000
        repeat: true
        running: true
        onTriggered: {
            refreshServerRegistry();
            pollAllServers();
        }
    }

    // --- JS Helper Functions ---

    function refreshServerRegistry() {
        var list = [];

        try {
            var raw = service.getSetting("DMXr", "serverRegistry");
            if (raw && raw !== "") {
                var registry = JSON.parse(raw);
                var keys = Object.keys(registry);
                for (var i = 0; i < keys.length; i++) {
                    list.push(registry[keys[i]]);
                }
            }
        } catch (e) {
            // Parse failed — fall through to fallback
        }

        // Fallback: if no registry data, build from manual host:port
        if (list.length === 0) {
            var host = serverHost || "127.0.0.1";
            var port = parseInt(serverPort) || 8080;
            list.push({
                serverId: host + ":" + port,
                serverName: "",
                host: host,
                port: port,
                udpPort: null,
                healthy: null,
                fixtureCount: 0,
            });
        }

        serverList = list;
        discoveredServerCount = list.length;
    }

    function pollAllServers() {
        var newHealthData = {};

        for (var i = 0; i < serverList.length; i++) {
            var srv = serverList[i];
            var sid = srv.serverId;
            var health = fetchServerHealth(srv);
            var fixtures = (health && health.reachable) ? fetchServerFixtures(srv) : [];

            newHealthData[sid] = {
                health: health,
                fixtures: fixtures,
            };
        }

        healthData = newHealthData;
    }

    function fetchServerHealth(srv) {
        try {
            var xhr = new XMLHttpRequest();
            xhr.open("GET", "http://" + srv.host + ":" + srv.port + "/health", false);
            xhr.send();

            if (xhr.status === 200) {
                var body = JSON.parse(xhr.responseText);
                return {
                    reachable: true,
                    driver: body.driver || "",
                    dmxDevicePath: body.dmxDevicePath || "",
                    connectionState: body.connectionState || "",
                    lastErrorTitle: body.lastErrorTitle || "",
                    lastErrorSuggestion: body.lastErrorSuggestion || "",
                    reconnectAttempts: body.reconnectAttempts || 0,
                    version: body.version || "",
                    serverId: body.serverId || srv.serverId,
                    serverName: body.serverName || srv.serverName,
                };
            }
        } catch (e) {
            // Server unreachable
        }

        return { reachable: false };
    }

    function fetchServerFixtures(srv) {
        try {
            var xhr = new XMLHttpRequest();
            xhr.open("GET", "http://" + srv.host + ":" + srv.port + "/fixtures", false);
            xhr.send();

            if (xhr.status === 200) {
                return JSON.parse(xhr.responseText);
            }
        } catch (e) {
            // Fetch failed
        }

        return [];
    }

    function testManualConnection() {
        try {
            var xhr = new XMLHttpRequest();
            xhr.open("GET", "http://" + serverHost + ":" + serverPort + "/health", false);
            xhr.send();

            if (xhr.status === 200) {
                manualTestStatus = "connected";
                service.log("DMXr: Manual test OK — " + serverHost + ":" + serverPort);
            } else {
                manualTestStatus = "error";
            }
        } catch (e) {
            manualTestStatus = "error";
            service.log("DMXr: Manual test failed — " + e);
        }
    }

    // --- Server card helper functions ---

    function getServerBorderColor(srv) {
        var h = healthData[srv.serverId];
        if (!h || !h.health || !h.health.reachable) return "#c03030";
        if (h.health.connectionState === "connected") return "#209e20";
        return "#d4a020";
    }

    function getServerDisplayName(srv) {
        var h = healthData[srv.serverId];
        if (h && h.health && h.health.serverName) return h.health.serverName;
        if (srv.serverName) return srv.serverName;
        return "DMXr Server";
    }

    function getDmxStatusText(srv) {
        var h = healthData[srv.serverId];
        if (!h || !h.health || !h.health.reachable) return "Server unreachable";

        var health = h.health;
        var driver = health.driver || "unknown";
        var driverLabel = driver === "enttec-usb-dmx-pro" ? "ENTTEC USB DMX Pro" : driver;

        if (driver === "null") return "No DMX driver configured (test mode)";
        if (health.connectionState === "connected") {
            return driverLabel + " on " + (health.dmxDevicePath || "?") + " — Connected";
        }
        if (health.connectionState === "reconnecting") {
            return driverLabel + " — Reconnecting...";
        }
        if (health.lastErrorTitle) return health.lastErrorTitle;
        return driverLabel + " — Disconnected";
    }

    function getDmxStatusColor(srv) {
        var h = healthData[srv.serverId];
        if (!h || !h.health || !h.health.reachable) return "#ff6060";

        var health = h.health;
        if (health.driver === "null") return "#8888ff";
        if (health.connectionState === "connected") return "#88ff88";
        return "#ffd060";
    }

    function getFixtureCountText(srv) {
        var h = healthData[srv.serverId];
        if (!h || !h.fixtures) return "0 fixtures";
        var count = h.fixtures.length;
        return count + " fixture" + (count !== 1 ? "s" : "");
    }

    function getServerVersion(srv) {
        var h = healthData[srv.serverId];
        if (h && h.health && h.health.version) return h.health.version;
        return "";
    }

    function getReconnectAttempts(srv) {
        var h = healthData[srv.serverId];
        if (h && h.health) return h.health.reconnectAttempts || 0;
        return 0;
    }

    function getErrorSuggestion(srv) {
        var h = healthData[srv.serverId];
        if (!h || !h.health) return "";
        var health = h.health;
        if (health.connectionState === "connected") return "";
        return health.lastErrorSuggestion || "";
    }

    function getServerFixtures(srv) {
        var h = healthData[srv.serverId];
        if (h && h.fixtures) return h.fixtures;
        return [];
    }

    // --- Auto-refresh on load ---
    Component.onCompleted: {
        refreshServerRegistry();
        pollAllServers();
    }
}
