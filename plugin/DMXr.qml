Item {
	anchors.fill: parent
	Column {
		width: parent.width
		height: parent.height
		spacing: 10
		Column {
			width: parent.width
			height: 80
			Rectangle {
				width: parent.width
				height: parent.height
				color: "#1a1a2e"
				radius: 5
				Column {
					x: 10
					y: 10
					width: parent.width - 20
					spacing: 5
					Text {
						color: theme.primarytextcolor
						text: "<u><strong>DMXr - DMX Bridge for SignalRGB</strong></u>"
						font.pixelSize: 16
						font.family: "Poppins"
						font.bold: true
					}
					Text {
						color: theme.primarytextcolor
						text: "Controls DMX fixtures via a local Node.js server."
						font.pixelSize: 12
						font.family: "Poppins"
					}
				}
			}
		}
		ListView {
			id: controllerList
			model: service.controllers
			width: parent.width
			height: parent.height - 100
			clip: true
			spacing: 5
			delegate: Item {
				width: parent.width
				height: 70
				Rectangle {
					width: parent.width
					height: parent.height - 5
					color: "#292929"
					radius: 5
				}
				Column {
					x: 10
					y: 8
					spacing: 3
					Text {
						color: theme.primarytextcolor
						text: modelData.name
						font.pixelSize: 14
						font.family: "Poppins"
						font.bold: true
					}
					Text {
						color: theme.primarytextcolor
						text: "ID: " + modelData.id
						font.pixelSize: 11
						font.family: "Poppins"
					}
				}
			}
		}
	}
}
