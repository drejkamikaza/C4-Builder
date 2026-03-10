import figlet from 'figlet';
import { Command } from 'commander';
const program = new Command();
import pkg from './package.json' with { type: 'json' };
import chalk from 'chalk';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import Configstore from 'configstore';

import cmdHelp from './cli.help.js';
import cmdNewProject from './cli.new.js';
import cmdList from './cli.list.js';
import cmdSite from './cli.site.js';
import cmdCollect from './cli.collect.js';
import { build } from './build.js';
import watch from 'node-watch';

import { clearConsole } from './utils.js';

const intro = () => {
    console.log(chalk.blue(figlet.textSync('c4builder')));
    console.log(chalk.gray('Blow up your software documentation writing skills'));
};

const getOptions = (conf) => {
    return {
        PLANTUML_VERSION: conf.get('plantumlVersion'),
        GENERATE_MD: conf.get('generateMD'),
        GENERATE_PDF: conf.get('generatePDF'),
        GENERATE_WEBSITE: conf.get('generateWEB'),
        GENERATE_COMPLETE_MD_FILE: conf.get('generateCompleteMD'),
        GENERATE_COMPLETE_PDF_FILE: conf.get('generateCompletePDF'),
        GENERATE_LOCAL_IMAGES: conf.get('generateLocalImages'),
        EMBED_DIAGRAM: conf.get('embedDiagram'),
        ROOT_FOLDER: conf.get('rootFolder'),
        DIST_FOLDER: conf.get('distFolder'),
        PROJECT_NAME: conf.get('projectName'),
        REPO_NAME: conf.get('repoUrl'),
        HOMEPAGE_NAME: conf.get('homepageName'),
        WEB_THEME: conf.get('webTheme'),
        DOCSIFY_TEMPLATE: conf.get('docsifyTemplate'),
        INCLUDE_NAVIGATION: conf.get('includeNavigation'),
        INCLUDE_BREADCRUMBS: conf.get('includeBreadcrumbs'),
        INCLUDE_TABLE_OF_CONTENTS: conf.get('includeTableOfContents'),
        INCLUDE_LINK_TO_DIAGRAM: conf.get('includeLinkToDiagram'),
        PDF_CSS: conf.get('pdfCss') || path.join(__dirname, 'pdf.css'),
        DIAGRAMS_ON_TOP: conf.get('diagramsOnTop'),
        CHARSET: conf.get('charset'),
        WEB_PORT: conf.get('webPort'),
        HAS_RUN: conf.get('hasRun'),
        PLANTUML_SERVER_URL: conf.get('plantumlServerUrl'),
        DIAGRAM_FORMAT: conf.get('diagramFormat'),
        MD_FILE_NAME: 'README',
        WEB_FILE_NAME: 'HOME',
        SUPPORT_SEARCH: conf.get('supportSearch'),
        EXCLUDE_OTHER_FILES: conf.get('excludeOtherFiles')
    };
};

export default async () => {
    const args = process.argv.slice(2);
    const subcommand = args.find(a => !a.startsWith('-'));

    program
        .version(pkg.version)
        .option('-w, --watch', 'watch for changes and rebuild')
        .option('-p, --port <n>', 'port used for serving the generated site', parseInt)
        .allowUnknownOption()
        .parse(process.argv);

    const opts = program.opts();

    // Merge subcommand flags with commander option flags
    const cmd = {
        new:    subcommand === 'new',
        config: subcommand === 'config',
        list:   subcommand === 'list',
        reset:  subcommand === 'reset',
        site:   subcommand === 'site',
        docs:   subcommand === 'docs',
        watch:  opts.watch,
        port:   opts.port,
    };

    let conf = { get: () => {} };
    if (!cmd.new)
        conf = new Configstore(
            process.cwd().split(path.sep).splice(1).join('_'),
            {},
            { configPath: path.join(process.cwd(), '.c4builder') }
        );

    if (cmd.docs) return cmdHelp();

    //initial options
    let options = getOptions(conf);

    if (cmd.new || cmd.config || !options.HAS_RUN) clearConsole();

    intro();

    if (!options.HAS_RUN && !cmd.new) {
        console.log(
            `\nif you created the project using the 'c4model new' command you can just press enter and go with the default options to get a basic idea of how it works.\n`
        );
        console.log(`you can always change the configuration by running > c4builder config\n`);
    }

    if (cmd.new) return cmdNewProject();
    if (cmd.list) return cmdList(options);

    if (cmd.reset) {
        conf.clear();
        console.log(`configuration was reset`);
        return;
    }

    await cmdCollect(options, conf, cmd);
    if (!cmd.config) {
        conf.set('hasRun', true);

        let isBuilding = false;
        let attemptedWatchBuild = false;
        //get options after wizard
        options = getOptions(conf);
        if (cmd.watch) {
            watch(options.ROOT_FOLDER, { recursive: true }, async (evt, name) => {
                // clearConsole();
                // intro();
                console.log(chalk.gray(`\n${name} changed. Rebuilding...`));
                if (isBuilding) {
                    attemptedWatchBuild = true;
                    if (
                        options.GENERATE_PDF ||
                        options.GENERATE_COMPLETE_PDF_FILE ||
                        options.GENERATE_LOCAL_IMAGES
                    )
                        console.log(
                            chalk.bold(
                                chalk.yellow(
                                    'Build already in progress, consider disabling pdf or local image generation '
                                )
                            )
                        );

                    return;
                }

                isBuilding = true;
                await build(options, conf);
                while (attemptedWatchBuild) {
                    attemptedWatchBuild = false;
                    await build(options);
                }
                isBuilding = false;
            });
        }

        isBuilding = true;
        await build(options, conf);
        isBuilding = false;

        if (cmd.site) return await cmdSite(options, cmd);

        if (options.GENERATE_WEBSITE && !cmd.watch) {
            console.log(chalk.gray('\nto view the generated website run'));
            console.log(`> c4builder site`);
        }
    }
};
