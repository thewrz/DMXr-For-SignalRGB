Item {
    anchors.fill: parent

    property string serverHost: service.getSetting("DMXr", "serverHost") || "127.0.0.1"
    property string serverPort: service.getSetting("DMXr", "serverPort") || "8080"
    property string connectionStatus: "disconnected"
    property var fixtureList: []

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

    // --- HTTP Helpers ---

    function getBaseUrl() {
        return "http://" + serverHost + ":" + serverPort;
    }

    function testConnection() {
        connectionStatus = "disconnected";

        try {
            var xhr = new XMLHttpRequest();
            xhr.open("GET", getBaseUrl() + "/health", false);
            xhr.send();

            if (xhr.status === 200) {
                connectionStatus = "connected";
                service.log("DMXr: Server connected at " + serverHost + ":" + serverPort);
                fetchFixtures();
            } else {
                connectionStatus = "error";
                service.log("DMXr: Server returned HTTP " + xhr.status);
            }
        } catch (e) {
            connectionStatus = "error";
            service.log("DMXr: Connection failed - " + e);
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
