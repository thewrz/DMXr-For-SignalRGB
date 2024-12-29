# DMXr-For-SignalRGB
A plug-in for SignalRGB that sends color data to a Node.js locally hosted server that runs dmx and open fixture libraries to translate the color data from SignalRGB into DMX serial data to send to fixtures using common USB to Serial DMX interfaces.

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

## Other musings
- Do I really need to use Node.js server at all?
- Can I somehow use the JSON definitions of the OFL directly within a signal RGB .js plug-in so that I can create drop-downs to select fixtures?
  - That would mean writing some code to directly interface with the Enttec USB device, as well as doing the DMX conversion directly within the SignalRGB plugin.
  - How would I "create" new devices in the the SignalRGB .js plug-in interface?
  - How would I control the DMX universe? Fixture "A" may have 9 channels. Fixture "B" may have 14 channels. And as you add them the plug-in will have to know how to use the next available channel in the DMX universe as you fill up fixtures.

