import { Cli } from "./cli/Cli.js";
import { CommandLineParser } from "./cli/CommandLineParser.js";
import { CommandDispatcher } from "./cli/CommandDispatcher.js";
import { EditorSession } from "./application/EditorSession.js";

await new Cli(new EditorSession(), new CommandLineParser(), new CommandDispatcher()).run();
