# Quickstart: 025
```bash
REFS=~/.nuget/packages/microsoft.netframework.referenceassemblies.net48/1.0.3/build/.NETFramework/v4.8
java -jar engine/target/java-dependency-extractor.jar <vb-project> out.json --language=dotnet --config="{\"analysis\":{\"extended\":\"on\",\"referenceAssemblies\":\"$REFS\"}}"
```
