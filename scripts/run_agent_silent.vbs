Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "d:\Proyecto - Checador"
WshShell.Run """C:\Users\Aaron Arenas Mtz\AppData\Local\Programs\Python\Python313\pythonw.exe"" ""d:\Proyecto - Checador\scripts\agent_fa200_realtime.py""", 0, False
Set WshShell = Nothing
