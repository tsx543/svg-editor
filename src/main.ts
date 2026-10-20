import { Cli } from "./cli/Cli.js";
import { CommandLineParser } from "./cli/CommandLineParser.js";
import { CommandDispatcher } from "./cli/CommandDispatcher.js";
import { EditorSession } from "./application/EditorSession.js";
import { NodeFileStore } from "./infrastructure/NodeFileStore.js";
import { SvgCodec } from "./svg/SvgCodec.js";
import { SvgDocumentGateway } from "./svg/SvgDocumentGateway.js";

const gateway = new SvgDocumentGateway(new NodeFileStore(), new SvgCodec());
await new Cli(new EditorSession(gateway), new CommandLineParser(), new CommandDispatcher()).run();
