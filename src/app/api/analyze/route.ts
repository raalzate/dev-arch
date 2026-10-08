
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { exec, type ExecException } from 'child_process';
import AdmZip from 'adm-zip';

// Helper function to execute a command in a shell
function executeCommand(command: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Command failed: ${command}`);
        console.error(stderr);
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // --- 1. Create a temporary directory ---
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'archview-'));
    const zipFilePath = path.join(tempDir, file.name);

    // --- 2. Save the uploaded .zip file ---
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(zipFilePath, fileBuffer);

    // --- 3. Unzip the file ---
    const projectDir = path.join(tempDir, 'project');
    await fs.mkdir(projectDir);
    try {
      const zip = new AdmZip(zipFilePath);
      zip.extractAllTo(projectDir, /*overwrite*/ true);
    } catch (e) {
      console.error("Error unzipping file", e);
      return NextResponse.json({ error: 'Failed to unzip the provided file.' }, { status: 500 });
    }


    // --- 4. Locate the JAR file ---
    const jarPath = path.resolve(process.cwd(), 'java-dependency-extractor.jar');

    // Check if JAR exists
    try {
      await fs.access(jarPath);
    } catch {
      console.error("java-dependency-extractor.jar not found in project root directory");
      return NextResponse.json({ error: 'Analyzer tool (java-dependency-extractor.jar) not found on server. Please make sure it is in the project root directory.' }, { status: 500 });
    }

    // --- 5. Run the Java dependency extractor ---


    // Important: Find the actual project root inside the unzipped folder
    const unzippedFiles = await fs.readdir(projectDir);
    let projectRoot = projectDir;
    if (unzippedFiles.length === 1) {
      const potentialRoot = path.join(projectDir, unzippedFiles[0]);
      if ((await fs.stat(potentialRoot)).isDirectory()) {
        projectRoot = potentialRoot;
      }
    }

    const command = `java -jar ${jarPath} ${projectRoot} output.json`;
    console.log(`Executing: ${command}`);

    try {
      await executeCommand(command);
    } catch (error) {
      console.error('Error running java-dependency-extractor.jar:', error);
      const execError = error as ExecException;
      return NextResponse.json({ error: `Failed to analyze the project with the Java tool.\n\nDetails:\n${execError.message}` }, { status: 500 });
    }
    // --- 6. Read the generated JSON files ---
    let componentsData, archData;
    try {
      componentsData = JSON.parse(await fs.readFile(path.join(process.cwd(), 'output.json'), 'utf-8'));
      archData = JSON.parse(await fs.readFile(path.join(process.cwd(), 'output_architecture.json'), 'utf-8'));
    } catch (readError) {
      console.error('Error reading output JSON files:', readError);
      return NextResponse.json({ error: 'Analysis completed, but failed to read result files. Check server logs for output file path.' }, { status: 500 });
    }

    // --- 7. Clean up the temporary directory ---
    // User requested to preserve the files to allow source code viewing
    // await fs.rm(tempDir, { recursive: true, force: true });

    // --- 8. Return the data ---
    return NextResponse.json({ componentsData, archData });

  } catch (error) {
    console.error('An unexpected error occurred:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: `Server error: ${errorMessage}` }, { status: 500 });
  }
}
