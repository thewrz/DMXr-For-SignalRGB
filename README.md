# DMXr-For-SignalRGB
A plug-in for SignalRGB that sends color data to a Node.js locally hosted server that runs dmx and open fixture libraries to translate the color data from SignalRGB into DMX serial data to send to fixtures using common USB to Serial DMX interfaces.

# Miro board link to view progress/ideas:

https://miro.com/app/board/uXjVLyC0vEI=/?share_link_id=676503878203

## Goals for MVP
- Write a .js plug-in for SignalRGB that does the following:
  - Expects there to be a Node.js server running the DMX libraries running on the system and asks the user to specify the IP address (127.0.0.1) and port number. For testing this will be hard-coded to get MVP going.
  - Creates a SignalRGB "device" which for now will simply grab ONE pixel of color data and will send DMX channel data to DMX server
  - Device will be a simple 4 channel DMX device to start. Brightness, Red, Green, and Blue. It will presume that this will all be sent on DMX channel 1
  - Convert a SignalRGB "pixel" into 4 discrete parts: Brightness, Red, Green, and Blue and all in values of 0-255.
  - DECISION: Do we convert the data into a DMX "packet" within the SignalRGB .js plugin? **OR** do we just send the four channels of data in integer values to the DMX server and have it interpret?
- Create a node.js server
  - This is where the primary communication with the DMX to Serial USB interface happens.
  - Utilize these libraries:
    - https://github.com/node-dmx/dmx
    - https://github.com/OpenLightingProject/open-fixture-library (although if there a way to make the SignalRGB plug-in use this and have a drop-down function that would simplify how to communicate with the DMX interface)

# Other musings
## Node.js server really needed?
- Do I really need to use Node.js server at all?
- Can I somehow use the JSON definitions of the OFL directly within a signal RGB .js plug-in so that I can create drop-downs to select fixtures?
  - That would mean writing some code to directly interface with the Enttec USB device, as well as doing the DMX conversion directly within the SignalRGB plugin.
  - How would I "create" new devices in the the SignalRGB .js plug-in interface?
  - How would I control the DMX universe? Fixture "A" may have 9 channels. Fixture "B" may have 14 channels. And as you add them the plug-in will have to know how to use the next available channel in the DMX universe as you fill up fixtures.

## What about other options
- If there's a headless version of QLC+ that we can turn into a "Network Service" in SignalRGB that would provide a lot better functionality. I am learning that plug-ins in SignalRGB are very limited and that creating a Network Service may be the better approach.

## Latency and timing
DMX requires a constant rate of data in order for the receiving fixture to be happy and display the desired color. 30Hz is pretty common for most fixtures, but not all. One thing the solution will need to take into account the rate in which SignalRGB sends updated pixel color/brightness data and making sure that is in sync with what the DMX protocol is expecting to keep the fixtures working correctly (otherwise you'll get flickering, or no light output at all from the fixture).

With this in mind.
- Is Node.js server the best solution? How will we handle the signal conversion rate to be fast enough that the DMX stream gets enough data to continue outputting correctly.
- Will we need to introduce some kind of loop that just copies the same received signal from SignalRGB as the next DMX frame if it doesn't receive a new signal from SignalRGB in a timely fashion? (this could be overthinking, computers are... fast these days)


# Hardware
This will initially be based off of using the Enttec PRO USB as our main hardware interface. 

https://www.enttec.com/product/dmx-usb-interfaces/dmx-usb-pro-professional-1u-usb-to-dmx512-converter/

![image](https://github.com/user-attachments/assets/c24e3d8e-5047-4887-8c07-d9f638178dc2)




# Relevant links for further research and ideas:
https://github.com/node-dmx/dmx

https://github.com/OpenLightingProject/open-fixture-library

https://github.com/mcallegari/qlcplus

https://open-fixture-library.org/fixture-editor

https://github.com/ASLS-org/studio

https://github.com/aroffringa/glight

Initial conversation on SignalRGB discord: https://discord.com/channels/803347488190365737/841741611544346624/1322984821521383446
