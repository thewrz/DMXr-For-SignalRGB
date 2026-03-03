Item {
    anchors.fill: parent

    property string serverHost: service.getSetting("DMXr", "serverHost") || "127.0.0.1"
    property string serverPort: service.getSetting("DMXr", "serverPort") || "8080"
    property string connectionStatus: "disconnected"
    property var fixtureList: []
    property int discoveredServerCount: 0

    // Hardware status from /health
    property string dmxDriver: ""
    property string dmxDevicePath: ""
    property string dmxConnectionState: ""
    property string dmxLastError: ""
    property string dmxLastErrorTitle: ""
    property string dmxLastErrorSuggestion: ""
    property int dmxReconnectAttempts: 0
    property string serverVersion: ""

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
                text: "Connect to your DMXr server to sync DMX fixtures with SignalRGB."
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

            // --- Server Connection ---
            Text {
                text: "Server Connection"
                color: theme.primarytextcolor
                font.family: "Poppins"
                font.weight: Font.Bold
                font.pixelSize: 16
            }

            Text {
                visible: discoveredServerCount > 0
                text: discoveredServerCount + " server" + (discoveredServerCount !== 1 ? "s" : "") + " discovered via mDNS"
                color: "#88ff88"
                font.family: "Poppins"
                font.pixelSize: 12
                opacity: 0.8
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

            // --- Connection Status + Buttons ---
            Row {
                spacing: 12
                height: 32

                // Status indicator
                Rectangle {
                    width: 12
                    height: 12
                    radius: width / 2
                    anchors.verticalCenter: parent.verticalCenter
                    color: connectionStatus === "connected" ? "#209e20"
                         : connectionStatus === "error" ? "#c03030"
                         : "#606060"
                }

                Text {
                    text: connectionStatus === "connected" ? "Connected"
                        : connectionStatus === "error" ? "Connection Error"
                        : "Disconnected"
                    color: theme.primarytextcolor
                    font.family: "Poppins"
                    font.pixelSize: 13
                    anchors.verticalCenter: parent.verticalCenter
                }

                // Test Connection button
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
                            testConnection();
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

                // Refresh Fixtures button
                Item {
                    width: 130
                    height: 30

                    Rectangle {
                        anchors.fill: parent
                        color: "#305080"
                        radius: 2
                    }

                    ToolButton {
                        width: parent.width
                        height: parent.height
                        anchors.verticalCenter: parent.verticalCenter
                        font.family: "Poppins"
                        font.bold: true
                        font.pixelSize: 12
                        text: "Refresh Fixtures"

                        onClicked: {
                            fetchFixtures();
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

                // Open Web Manager button
                Item {
                    visible: connectionStatus === "connected"
                    width: 150
                    height: 30

                    Rectangle {
                        anchors.fill: parent
                        color: "#6a3d9a"
                        radius: 2
                    }

                    ToolButton {
                        width: parent.width
                        height: parent.height
                        anchors.verticalCenter: parent.verticalCenter
                        font.family: "Poppins"
                        font.bold: true
                        font.pixelSize: 12
                        text: "Open Web Manager"

                        onClicked: {
                            Qt.openUrlExternally(getBaseUrl());
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

            // --- DMX Hardware Status (visible when connected to server) ---

            // DMX connected — green card
            Column {
                visible: connectionStatus === "connected" && dmxConnectionState === "connected"
                width: parent.width - 40
                spacing: 0

                Rectangle {
                    width: parent.width
                    height: dmxConnectedContent.height + 20
                    radius: 4
                    color: "#1a2a1a"
                    border.color: "#209e20"
                    border.width: 1

                    Column {
                        id: dmxConnectedContent
                        x: 16
                        y: 10
                        width: parent.width - 32
                        spacing: 4

                        Text {
                            text: "DMX Hardware: " + (dmxDriver === "enttec-usb-dmx-pro" ? "ENTTEC USB DMX Pro" : dmxDriver) + " on " + dmxDevicePath + " — Connected"
                            color: "#88ff88"
                            font.family: "Poppins"
                            font.weight: Font.Bold
                            font.pixelSize: 13
                            width: parent.width
                            wrapMode: Text.WordWrap
                        }
                    }
                }
            }

            // DMX disconnected/reconnecting but server is connected — amber card
            Column {
                visible: connectionStatus === "connected" && dmxDriver !== "null" && (dmxConnectionState === "disconnected" || dmxConnectionState === "reconnecting")
                width: parent.width - 40
                spacing: 0

                Rectangle {
                    width: parent.width
                    height: dmxWarnContent.height + 24
                    radius: 4
                    color: "#2a2a1a"
                    border.color: "#d4a020"
                    border.width: 1

                    Column {
                        id: dmxWarnContent
                        x: 16
                        y: 12
                        width: parent.width - 32
                        spacing: 8

                        Text {
                            text: dmxLastErrorTitle || "DMX adapter is not connected"
                            color: "#ffd060"
                            font.family: "Poppins"
                            font.weight: Font.Bold
                            font.pixelSize: 14
                        }

                        Text {
                            text: dmxLastErrorSuggestion || "The server is running but can't reach your DMX hardware.\n1. Check the USB cable to your DMX adapter\n2. Open the Web Manager to verify the COM port\n3. Make sure no other software is using the adapter"
                            color: theme.primarytextcolor
                            font.family: "Poppins"
                            font.pixelSize: 12
                            opacity: 0.8
                            width: parent.width
                            wrapMode: Text.WordWrap
                        }

                        Text {
                            visible: dmxReconnectAttempts > 0
                            text: "Reconnect attempt " + dmxReconnectAttempts + "..."
                            color: theme.primarytextcolor
                            font.family: "Poppins"
                            font.pixelSize: 11
                            opacity: 0.6
                        }

                        Item {
                            width: 150
                            height: 28

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
                                    Qt.openUrlExternally(getBaseUrl());
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
                }
            }

            // Null driver — info card
            Column {
                visible: connectionStatus === "connected" && dmxDriver === "null"
                width: parent.width - 40
                spacing: 0

                Rectangle {
                    width: parent.width
                    height: dmxNullContent.height + 24
                    radius: 4
                    color: "#1a1a2a"
                    border.color: "#4060a0"
                    border.width: 1

                    Column {
                        id: dmxNullContent
                        x: 16
                        y: 12
                        width: parent.width - 32
                        spacing: 8

                        Text {
                            text: "No DMX driver configured"
                            color: "#8888ff"
                            font.family: "Poppins"
                            font.weight: Font.Bold
                            font.pixelSize: 14
                        }

                        Text {
                            text: "The server is running in test mode (no DMX output).\nOpen the Web Manager to configure your DMX adapter."
                            color: theme.primarytextcolor
                            font.family: "Poppins"
                            font.pixelSize: 12
                            opacity: 0.8
                            width: parent.width
                            wrapMode: Text.WordWrap
                        }

                        Item {
                            width: 150
                            height: 28

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
                                    Qt.openUrlExternally(getBaseUrl());
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
                }
            }

            // --- Server Setup Guide (visible when connection fails) ---
            Column {
                visible: connectionStatus === "error"
                width: parent.width - 40
                spacing: 10

                Rectangle {
                    width: parent.width
                    height: setupGuideContent.height + 24
                    radius: 4
                    color: "#2a1a1a"
                    border.color: "#c03030"
                    border.width: 1

                    Column {
                        id: setupGuideContent
                        x: 16
                        y: 12
                        width: parent.width - 32
                        spacing: 8

                        Text {
                            text: "DMXr Server Setup"
                            color: "#ff8888"
                            font.family: "Poppins"
                            font.weight: Font.Bold
                            font.pixelSize: 14
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
                            text: "2. Extract the zip to any folder (e.g. Desktop)"
                            color: theme.primarytextcolor
                            font.family: "Poppins"
                            font.pixelSize: 12
                            opacity: 0.8
                            width: parent.width
                            wrapMode: Text.WordWrap
                        }

                        Text {
                            text: "3. Double-click DMXr-Server.bat\n    A console window will open. Keep it running."
                            color: theme.primarytextcolor
                            font.family: "Poppins"
                            font.pixelSize: 12
                            opacity: 0.8
                            width: parent.width
                            wrapMode: Text.WordWrap
                        }

                        Text {
                            text: '4. Click "Test Connection" above'
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
                            text: "- Server on a different PC? Enter its IP in the Host field\n- Windows Firewall prompt? Click \"Allow access\"\n- Changed the port? Update it in the Port field (default: 8080)"
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

            // --- Fixtures Section ---
            Text {
                text: "Fixtures"
                color: theme.primarytextcolor
                font.family: "Poppins"
                font.weight: Font.Bold
                font.pixelSize: 16
            }

            Text {
                text: fixtureList.length === 0
                    ? "No fixtures found. Add fixtures via the web UI at http://" + serverHost + ":" + serverPort
                    : fixtureList.length + " fixture" + (fixtureList.length !== 1 ? "s" : "") + " configured"
                color: theme.primarytextcolor
                font.family: "Poppins"
                font.pixelSize: 13
                opacity: 0.7
                width: parent.width - 40
                wrapMode: Text.WordWrap
            }

            // Fixture cards
            Repeater {
                model: fixtureList

                Rectangle {
                    width: mainColumn.width - 40
                    height: fixtureContent.height + 20
                    radius: 4
                    color: "#1a2633"
                    border.color: "#2a3a4a"
                    border.width: 1

                    Column {
                        id: fixtureContent
                        x: 16
                        y: 10
                        spacing: 4

                        Text {
                            text: modelData.name || "Unknown"
                            color: theme.primarytextcolor
                            font.family: "Poppins"
                            font.weight: Font.Bold
                            font.pixelSize: 14
                        }

                        Row {
                            spacing: 16

                            Text {
                                text: "DMX " + (modelData.startAddress || "?")
                                color: theme.primarytextcolor
                                font.family: "Poppins"
                                font.pixelSize: 12
                                opacity: 0.6
                            }

                            Text {
                                text: (modelData.channelCount || "?") + " ch"
                                color: theme.primarytextcolor
                                font.family: "Poppins"
                                font.pixelSize: 12
                                opacity: 0.6
                            }

                            Text {
                                text: modelData.manufacturer || ""
                                color: theme.primarytextcolor
                                font.family: "Poppins"
                                font.pixelSize: 12
                                opacity: 0.6
                                visible: text !== ""
                            }
                        }
                    }
                }
            }
        }
    }

    // --- Auto-poll status when connected ---
    Timer {
        interval: 5000
        repeat: true
        running: connectionStatus === "connected"
        onTriggered: testConnection()
    }

    // --- HTTP Helpers ---

    function getBaseUrl() {
        return "http://" + serverHost + ":" + serverPort;
    }

    function testConnection() {
        var previousStatus = connectionStatus;

        try {
            var xhr = new XMLHttpRequest();
            xhr.open("GET", getBaseUrl() + "/health", false);
            xhr.send();

            if (xhr.status === 200) {
                connectionStatus = "connected";

                try {
                    var body = JSON.parse(xhr.responseText);
                    dmxDriver = body.driver || "";
                    dmxDevicePath = body.dmxDevicePath || "";
                    dmxConnectionState = body.connectionState || "";
                    dmxLastError = body.lastDmxSendError || "";
                    dmxLastErrorTitle = body.lastErrorTitle || "";
                    dmxLastErrorSuggestion = body.lastErrorSuggestion || "";
                    dmxReconnectAttempts = body.reconnectAttempts || 0;
                    serverVersion = body.version || "";
                } catch (parseErr) {
                    // Body parse failed — connection still OK
                }

                if (previousStatus !== "connected") {
                    service.log("DMXr: Server connected at " + serverHost + ":" + serverPort);
                    fetchFixtures();
                }
            } else {
                connectionStatus = "error";
                if (previousStatus !== "error") {
                    service.log("DMXr: Server returned HTTP " + xhr.status);
                }
            }
        } catch (e) {
            connectionStatus = "error";
            if (previousStatus !== "error") {
                service.log("DMXr: Connection failed - " + e);
            }
        }
    }

    function fetchFixtures() {
        try {
            var xhr = new XMLHttpRequest();
            xhr.open("GET", getBaseUrl() + "/fixtures", false);
            xhr.send();

            if (xhr.status === 200) {
                var fixtures = JSON.parse(xhr.responseText);
                fixtureList = fixtures;
                service.log("DMXr: Loaded " + fixtures.length + " fixtures");
            } else {
                service.log("DMXr: Failed to fetch fixtures - HTTP " + xhr.status);
            }
        } catch (e) {
            service.log("DMXr: Fetch fixtures error - " + e);
        }
    }

    // Auto-test on load
    Component.onCompleted: {
        testConnection();
    }
}
