const Discord = require('discord.js'),
    math = require("mathjs"),
    fs = require('fs'),
    client = new Discord.Client();

client.on("ready", () => {
    console.log(`${client.user.tag} initialized.`);
});

client.on("message", async message => {
    const config = JSON.parse(fs.readFileSync('config.json')); //reread json at every message
    const sheets = JSON.parse(fs.readFileSync('sheets.json')); //reread json at every message
    const sheetsSynonyms = JSON.parse(fs.readFileSync('sheets-synonyms.json')); //reread json at every message

    if (message.author.bot || message.content.slice(0, config.prefix.length) !== config.prefix) //if it's the bot or first char isn't prefix, do nothing
    {
        return;
    };

    let msg, command, args, authorId;

    try {
        msg = message.content;
        command = msg.slice(config.prefix.length, msg.length).split(' ')[0]; // /roll 5d10 + 4d20 * d40 = 'roll'
        args = msg.replace(',', '.').slice(config.prefix.length + command.length + 1, msg.length).replace(/\s/g, '').toLowerCase(); // /rOLl 5D10 + 4d20 * d40 = '5d10+4d20*d40'
        authorId = message.author.id;
    }
    catch (err) {
        console.log(err);
        return ThrowError(authorId, message);
    }

    if (command.toLowerCase() == "r" || command.toLowerCase() == "roll") //roll command
    {
        if (args == 'help' || args == '') {
            console.log('Error!');
            return ThrowError(authorId, message);
        }

        try {
            let showEval,
                toEval = msg.replace(',', '.').slice(config.prefix.length + command.length + 1, msg.length).replace(/\s\s/g, ' ').toLowerCase();;

            let regex = '';

            for (let prop in sheetsSynonyms.infos) {
                for (let i = 0; i < sheetsSynonyms.infos[prop].length; i++) {
                    if (sheetsSynonyms.infos[prop][i].length == 3 && prop.substring(0, 1) != '#') {
                        regex += sheetsSynonyms.infos[prop][i] + '|';
                    }
                }
            }

            regex = new RegExp(`(${regex.substring(0, regex.length - 1)})`, 'g');

            let matches = toEval.match(regex);

            for (match in matches) {
                let arg = toEval.substring(toEval.indexOf(matches[match]) + 3, toEval.indexOf(matches[match]) + 5),
                    player = arg,
                    element = translate(sheetsSynonyms, matches[match]);

                if (player == translate(sheetsSynonyms, player)) {
                    player = 'p';
                    arg = '';
                    player = getPlayerName(sheets, player, authorId);
                }

                player = translate(sheetsSynonyms, player);

                let type;

                for (let prop in sheets[player]) {
                    if (typeof sheets[player][prop] === 'object' && sheets[player][prop] != null && element in sheets[player][prop] && (prop == 'About' || prop == 'Status' || prop == 'Attributes')) {
                        type = prop;
                    }
                }

                toEval = toEval.replace(`${matches[match]}${arg}`, `(${sheets[player][type][element]})`);
            }

            showEval = toEval.replace(/\s/g, '');

            const argsSplitted = toEval.split(/d(?=\d|f)/g); //split at every 'd' followed by a number or the letter 'f'

            for (let i = 0; i < argsSplitted.length - 1; i++) {
                let hackOn = true,
                    isFudge = false;

                let num = argsSplitted[i].match(/[\d]+$/), //match the last number 
                    sides = argsSplitted[i + 1].match(/^[\d]+|^f/), //match the first number or the first letter 'f'
                    min = (config.min < 1) ? 1 : config.min, //min lower limit is 1
                    max = (config.max < 1) ? hackOn = false : (config.max > sides) ? sides : config.max; //max upper limit is the number of sides and break if < 1

                if (num > 1500) {
                    const details = 'It is not possible to roll more than 1500 dice.';
                    console.log(details);
                    return ThrowError(authorId, message, details);
                }

                if (sides == 'f') //is fudge
                {
                    isFudge = true;
                }
                else {
                    sides = Number(sides);
                }

                hackOn = (min <= max) ? true : false;

                let addition = '';

                if (isFudge) {
                    const toRandomize = ['-', 'b', '+'];

                    for (let j = 0; j < ((num === null) ? 1 : Number(num)); j++) {
                        addition += math.pickRandom(toRandomize);
                    }
                    addition = '(' + addition.substring(0, addition.length) + ')';

                    showEval = showEval.replace((num || '') + 'df', addition);

                    toEval = toEval.replace((num || '') + 'df', addition.replace(/\+/g, '+1').replace(/b/g, '+0').replace(/-/g, '-1')); //replace '+' into '+1', 'b' into '+0' and '-' into '-1'
                }
                else {
                    for (let k = 0; k < ((num === null) ? 1 : Number(num)); k++) {
                        let rand;
                        if (((config.master_on && authorId == config.master_id) || (config.players_on && authorId != config.master_id)) && hackOn) //if hack is on
                        {
                            rand = math.randomInt(min, max + 1);
                        }
                        else {
                            rand = math.randomInt((sides == 0) ? 0 : 1, sides + 1);
                        }
                        addition += (rand == sides) ? `**${rand}**+` : `${rand}+`; //if critical, write it bold
                    }
                    addition = '(' + addition.substring(0, addition.length - 1) + ')';

                    showEval = showEval.replace((num || '') + 'd' + sides, addition);

                    toEval = toEval.replace((num || '') + 'd' + sides, addition).replace(/\*\*/g, ''); //remove bold style to evaluate
                }
            }
            const result = math.evaluate(toEval),
                output = `<@${authorId}>: \`${args}\` = ${showEval} = ${result}`;

            if (output.length <= 2000) {
                message.channel.send(output).catch(err => {
                    return ThrowError(authorId, message);
                });
            }
            else {
                const details = 'The message should be length less than or equal to 2000.';
                console.log(details);
                return ThrowError(authorId, message, details);
            }
        }
        catch (err) {
            console.log(err);
            return ThrowError(authorId, message);
        }
    }
    else if (command.toLowerCase() == 'calc' || command.toLowerCase() == 'c') //calc command
    {
        try {
            const result = math.evaluate(args);
            message.channel.send(`<@${authorId}>: \`${args}\` = ${result}`).catch(err => {
                return ThrowError(authorId, message);
            });
        }
        catch (err) {
            console.log(err);
            return ThrowError(authorId, message);
        }
    }
    else if (command.toLowerCase() == 'pokemon') //pokemon command
    {
        return ThrowError(authorId, message).catch(err => {
            return ThrowError(authorId, message);
        });
    }
    else if (command.toLowerCase() == 'count' || command.toLowerCase() == 'react' || command.toLowerCase() == 'p') //count command
    {
        if (args == '') {
            const pause = ms => new Promise(resolve => setTimeout(resolve, ms)),
                counter = async () => {
                    const reactTime = 3;

                    for (let i = reactTime; i > 0; i--) {
                        message.channel.send(`\`\`\`fix\n${i}\n\`\`\``).catch(err => {
                            return ThrowError(authorId, message);
                        }); //yellowed text
                        await pause(900);
                    }
                    message.channel.send('```CSS\nDone```').catch(err => {
                        return ThrowError(authorId, message);
                    }); //greened text
                };
            counter();
        }
        else {
            console.log('Error: This command requires no arguments.');
            return ThrowError(authorId, message);
        }
    }
    else if (command.toLowerCase() == 's' || command.toLowerCase() == 'sheet') //sheet command
    {
        try {
            let argsSplitted = msg.replace(/\s\s+/g, ' ').slice(config.prefix.length + command.length + 1, msg.length).toLowerCase().match(/[^=+-]*/), // '/s  one two   three  = four + five= six' = ["one", "two", "three"]
                value = msg.replace(/\s\s+/g, ' ').slice(config.prefix.length + command.length + 1, msg.length).match(/[=+-].*$/); // '/s  one two   three  = FOUR + five= six' = "= FOUR + five= six"

            argsSplitted = (argsSplitted == null) ? [''] : argsSplitted.toString().trim().split(' ');
            value = (value == null) ? '' : value.toString();

            let player = argsSplitted[0],
                type = (argsSplitted.length > 1) ? argsSplitted[1] : 'general';

            let thirdArg = (argsSplitted[2]) ? argsSplitted[2] : null,
                fourthArg = (argsSplitted[3]) ? argsSplitted[3] : null;

            player = getPlayerName(sheets, player, authorId);

            if (player == 'p') {
                const details = 'Player ID not found.';
                console.log(details);
                return ThrowError(authorId, message, details);
            }

            player = translate(sheetsSynonyms, player);
            type = translate(sheetsSynonyms, type);
            thirdArg = translate(sheetsSynonyms, thirdArg);
            fourthArg = translate(sheetsSynonyms, fourthArg);

            const all = player == 'a',
                playersLength = (all) ? Object.keys(sheets).length : 1;

            for (let i = 0; i < playersLength; i++) {
                if (all) {
                    player = Object.keys(sheets)[i];
                }
                const points = (5 + (sheets[player].Status.Level - 1) * 2) - (sheets[player].Attributes.Strength + sheets[player].Attributes.Resistance + sheets[player].Attributes.Dexterity + sheets[player].Attributes.Spirit + sheets[player].Attributes.Intelligence + sheets[player].Attributes.Perception + sheets[player].Attributes.Charisma + sheets[player].Attributes.Luck),
                    hpBase = 1200 + 200 * sheets[player].Attributes.Resistance + 200 * sheets[player].Status.Armor,
                    spBase = 1200 + 200 * sheets[player].Attributes.Dexterity - 200 * sheets[player].Status.Armor,
                    mpBase = 1200 + 100 * (sheets[player].Attributes.Spirit + sheets[player].Attributes.Intelligence) - 200 * (6 - sheets[player].Status.Sanity);

                if (value == '') //show
                {
                    const embed = createEmbed(sheets, player, type, points, [hpBase, spBase, mpBase], [sheets[player].Status.HPInc, sheets[player].Status.SPInc, sheets[player].Status.MPInc]);

                    if (typeof embed == 'string') {
                        console.log(embed);
                        return ThrowError(authorId, message, embed);
                    }

                    message.channel.send(embed).catch(err => {
                        const details = 'Thumbnail\'s path is not valid.';
                        console.log(details);
                        return ThrowError(authorId, message, details);
                    });
                }
                else {
                    let output;
                    if (type == 'Inventory') {
                        if (thirdArg in sheets[player][type]) {
                            eval(`sheets[player][type]['${thirdArg}']${value};`);

                            if (sheets[player][type][thirdArg] == '') {
                                output = `*The item **${thirdArg}** was removed from the inventory.*`;
                            }
                            else {
                                output = `*The item **${thirdArg}** from the inventory was updated to \`${(sheets[player][type][thirdArg].length > 48) ? sheets[player][type][thirdArg].substring(0, 45) + '...' : sheets[player][type][thirdArg]}\`.*`;
                            }

                            if (typeof sheets[player][type][thirdArg] != 'string') {
                                const details = 'The value must be in quotation marks.';
                                console.log(details);
                                return ThrowError(authorId, message, details);
                            }
                        }
                        else {
                            const details = 'Item number not found.';
                            console.log(details);
                            return ThrowError(authorId, message, details);
                        }
                    }
                    else if (type == 'Special Skill') {
                        if (thirdArg == 'Description' || thirdArg == 'Weakness' || thirdArg == 'Cost') {
                            eval(`sheets[player][type]['${thirdArg}']${value};`);

                            if (sheets[player][type][thirdArg] == '') {
                                output = `*The element **${thirdArg}** from Special Skill was removed.*`;
                            }
                            else {
                                output = `*The element **${thirdArg}** from Special Skill was updated to \`${(sheets[player][type][thirdArg].length > 48) ? sheets[player][type][thirdArg].substring(0, 45) + '...' : sheets[player][type][thirdArg]}\`.*`;
                            }

                            if (typeof sheets[player][type][thirdArg] != 'string') {
                                const details = 'The value must be in quotation marks.';
                                console.log(details);
                                return ThrowError(authorId, message, details);
                            }
                        }
                        else {
                            const details = 'Special Skill element not found.';
                            console.log(details);
                            return ThrowError(authorId, message, details);
                        }
                    }
                    else if (type == 'Skills') {
                        if (thirdArg in sheets[player][type]) {
                            if (fourthArg == 'Description' || fourthArg == 'Weakness' || fourthArg == 'Cost') {
                                eval(`sheets[player][type]['${thirdArg}']['${fourthArg}']${value};`);

                                if (sheets[player][type][thirdArg][fourthArg] == '') {
                                    output = `*The element **${fourthArg}** of skill **${thirdArg}** was removed.*`;
                                }
                                else {
                                    output = `*The element **${fourthArg}** of skill **${thirdArg}** was updated to \`${(sheets[player][type][thirdArg][fourthArg].length > 48) ? sheets[player][type][thirdArg][fourthArg].substring(0, 45) + '...' : sheets[player][type][thirdArg][fourthArg]}\`.*`;
                                }

                                if (typeof sheets[player][type][thirdArg][fourthArg] != 'string') {
                                    const details = 'The value must be in quotation marks.';
                                    console.log(details);
                                    return ThrowError(authorId, message, details);
                                }
                            }
                            else {
                                const details = 'Skill element not found.';
                                console.log(details);
                                return ThrowError(authorId, message, details);
                            }
                        }
                        else {
                            const details = 'Skill number not found.';
                            console.log(details);
                            return ThrowError(authorId, message, details);
                        }
                    }
                    else //about, status, attributes
                    {
                        let ok = false;
                        for (let prop in sheets[player]) {
                            if (typeof sheets[player][prop] === 'object' && sheets[player][prop] != null && type in sheets[player][prop] && (prop == 'About' || prop == 'Status' || prop == 'Attributes')) {
                                eval(`sheets[player][prop][type]${value};`);

                                if (sheets[player][prop][type] == '' && typeof sheets[player][prop][type] == 'string') {
                                    output = `*The element **${type}** was removed.*`;
                                }
                                else {
                                    if (type == 'HP' || type == 'SP' || type == 'MP') {
                                        const obj = {
                                            "HP": [hpBase, sheets[player].Status.HPInc],
                                            "SP": [spBase, sheets[player].Status.SPInc],
                                            "MP": [mpBase, sheets[player].Status.MPInc]
                                        };
                                        output = `*The element **${type}** was updated to \`${obj[type][0] + obj[type][1] + sheets[player][prop][type]}\`.*`;
                                    }
                                    else {
                                        output = `*The element **${type}** was updated to \`${(sheets[player][prop][type].length > 48) ? sheets[player][prop][type].substring(0, 45) + '...' : sheets[player][prop][type]}\`.*`;
                                    }
                                }

                                if (prop == 'About' && typeof sheets[player][prop][type] != 'string') {
                                    const details = 'The value must be in quotation marks.';
                                    console.log(details);
                                    return ThrowError(authorId, message, details);
                                }
                                else if ((prop == 'Status' || prop == 'Attributes') && typeof sheets[player][prop][type] != 'number') {
                                    const details = 'The value must be a number.';
                                    console.log(details);
                                    return ThrowError(authorId, message, details);
                                }
                                else if ((prop == 'Status' || prop == 'Attributes') && sheets[player][prop][type] > 1000000) {
                                    const details = 'The value must be less than or equal to 1000000.';
                                    console.log(details);
                                    return ThrowError(authorId, message, details);
                                }
                                ok = true;
                                break;
                            }
                        }
                        if (!ok) {
                            const details = 'Element not found.';
                            console.log(details);
                            return ThrowError(authorId, message, details);
                        }
                    }
                    fs.writeFile('sheets.json', JSON.stringify(sheets, null, '\t'), (err) => {
                        if (err) {
                            console.log(err);
                            return ThrowError(authorId, message);
                        }
                    });
                    message.channel.send(`<@${authorId}>: *(${player})* ${output}`);
                }
            }
        }
        catch (err) {
            console.log(err);
            return ThrowError(authorId, message);
        }
    }
    else if (command.toLowerCase() == 'help') //help command
    {
        const embed = new Discord.MessageEmbed()
            .setColor('#FEFEFE')
            .setTitle('Help')
            .addFields(
                { name: 'ROLL', value: '\`\/r [expression] [dice number] d [side number] [expression]\`\n**Expression** *(optional)* - Algebraic operation to be performed with the entire command line at the end of the process. It may include other data or attributes of a character\'s sheet in the form of the first three letters of the attribute concatenated with the first two letters of the player (such as \'per\', with reference to the attribute \'Perception\' of the user who wrote, or \'intjo\', referring to the intelligence of the character \'John\').\n**Dice Number** - Amount of dice to be rolled. If it does not exist, the value will be \'1\'.\n**Side Number** - Amount of faces of the die. It must be a number or the letter \'f\', alluding to the \'fate\/fudge\' die.', inline: false },
                { name: 'SHEET', value: '\`\/s [player] [session] [arg 1] [arg 2] [= value]\`\n**Session** - Session name, as \'inventory\', \'skills\', \'story\' or \'sheet\', for example. If it does not exist, the value \'sheet\' will be taken if there is no argument \'value\'.\n**Arg 1** *(optional)* - Name of the first session subdivision, such as \'age\', \'level\', \'intelligence\', \'description\'... Requires the argument \'value\'.\n**Arg 2** *(optional)* - Name of the second subdivision of the session, such as \'description\', \'weakness\' or \'cost\', for example. Refers to the skill. Requires the argument \'value\'.\n**Value** *(optional)* - Value to assign to the element described in arguments 1 and 2. If it is a word, it must be among quotes. If it does not exist, the two arguments will be ignored.', inline: false },
                { name: 'COUNT', value: '\`\/p\`\nIt starts a timer of 3 units equivalent to 2.7 seconds.', inline: false },
                { name: 'CALC', value: '\`\/c [expression]\`\n**Expression** - Algebraic operation.', inline: false },
                { name: 'POKÉMON', value: '\`\/pokemon\`\nReturns the name of a 1st generation Pokémon, randomly.', inline: false },
                { name: 'HELP', value: '\`\/help\`\nShows help.', inline: false }
            )

        return message.channel.send(embed).catch(err => {
            return ThrowError(authorId, message);
        });
    }
});

function createEmbed(sheets, player, type, points, bases, incs) {
    try {
        let embed = new Discord.MessageEmbed()
            .setColor(sheets[player].color)
            .setFooter(player);

        if (sheets[player].image_path != '') {
            let attachment = new Discord.MessageAttachment(sheets[player].image_path);
            embed.attachFiles(attachment)
                .setThumbnail('attachment://' + sheets[player].image_path.match(/[^\\]+$/g))
        }

        if (type == 'General') //general
        {
            const sections = ['About', 'Status', 'Attributes'];
            let values = ['', '', ''],
                outputNames = ['', '', '\u200B'];

            let j = 0;
            for (let i = 0; i < sections.length; i++) {
                for (let prop in sheets[player][sections[i]]) {
                    if (prop != 'Story' && prop != 'HPInc' && prop != 'SPInc' && prop != 'MPInc') {
                        if (prop == 'Name') {
                            if (sheets[player][sections[i]][prop] == '') {
                                outputNames[i] += `**${prop}:**`;
                            }
                            else {
                                outputNames[i] += `**${prop}:** *\`${sheets[player][sections[i]][prop]}\`*`;
                            }
                        }
                        else if (prop == 'Level') //level
                        {
                            outputNames[i] += `**${prop}:** *\`${sheets[player][sections[i]][prop]}\`*`;
                            values[i] += (points < 0) ? `**Available Points:** *${points}* :exclamation:\n` : (points > 0) ? `**Available Points:** *${points}* :grey_exclamation:\n` : `**Available Points:** *${points}*\n`; //points
                        }
                        else if (prop == 'HP' || prop == 'SP' || prop == 'MP') //HP, SP, MP
                        {
                            values[i] += `**${prop}:** *\`${math.evaluate(bases[j] + '+' + incs[j] + '+' + sheets[player][sections[i]][prop])}\` / ${bases[j]} + (${incs[j]}) = __${bases[j] + incs[j]}__*\n`;
                            j++;
                        }
                        else if (prop == 'Armor' || prop == 'Sanity') //Armor, Sanity
                        {
                            values[i] += `**${prop}:** *\`${getXs(sheets[player][sections[i]][prop], 6, 1)}\` = ${sheets[player][sections[i]][prop]}*\n`;
                        }
                        else if (i == 2) {
                            values[i] += `**${prop}:**\n*\`${getXs(sheets[player][sections[i]][prop], 15, 2)}\` = ${sheets[player][sections[i]][prop]}*\n`; //Attributes
                        }
                        else //Normal
                        {
                            if (sheets[player][sections[i]][prop] == '') {
                                values[i] += `**${prop}:**\n`;
                            }
                            else {
                                values[i] += `**${prop}:** *\`${sheets[player][sections[i]][prop]}\`*\n`;
                            }
                        }
                    }
                }
            }

            if (outputNames[0].length > 256 || outputNames[1].length > 256 || outputNames[2].length > 256) {
                return 'The name must be length less than or equal to 256.';
            }

            if (values[0].length > 1024 || values[1].length > 1024 || values[2].length > 1024) {
                return 'The sheet should be length less than or equal to 1024.';
            }

            embed.addFields(
                { name: outputNames[0], value: values[0], inline: true },
                { name: outputNames[1], value: values[1], inline: true },
                { name: outputNames[2], value: values[2], inline: false },
            );
        }
        else if (type == 'Skills') //skills
        {
            let empty = true;
            if (sheets[player]['Special Skill'].Description != '' && sheets[player]['Special Skill']['Weakness'] != '' && sheets[player]['Special Skill'].Weakness != '') {
                const value = `Description: *\`${sheets[player]['Special Skill'].Description}\`*\nWeakness: *\`${sheets[player]['Special Skill']['Weakness']}\`*\nCost: *\`${sheets[player]['Special Skill'].Cost}\`*`;

                if (value.length > 1024) {
                    return 'The Special Skill should be length less than or equal to 1024.';
                }

                embed.addField('**Special Skill**', value, false);
                empty = false;
            }

            let value = '';

            let i = 0;
            for (let prop in sheets[player]['Skills']) {
                if (sheets[player]['Skills'][prop].Description != '' && sheets[player]['Skills'][prop]['Weakness'] != '' && sheets[player]['Skills'][prop].Cost != '') {
                    i++;

                    value += `**${prop}**\nDescription: *\`${sheets[player]['Skills'][prop].Description}\`*\nWeakness: *\`${sheets[player]['Skills'][prop]['Weakness']}\`*\nCost: *\`${sheets[player]['Skills'][prop].Cost}\`*\n`;

                    if (i == 4) {
                        if (value.length > 1024) {
                            return 'The Skill should be length less than or equal to 1024.';
                        }
                        embed.addField('**Skills:**', value, true);
                        empty = false;
                        value = '';
                    }
                }
            }

            if (value != '') {
                if (value.length > 1024) {
                    return 'The Skill should be length less than or equal to 1024.';
                }
                if (i < 4) {
                    embed.addField('**Skills:**', value, true);
                }
                else {
                    embed.addField('\u200B', value, true);
                }
                empty = false;
            }

            if (empty) {
                embed.addField('**Skills:**', '*No skills.*', true);
            }
        }
        else if (type == 'Inventory') //inventory
        {
            let value = '';

            for (let prop in sheets[player].Inventory) {
                if (sheets[player].Inventory[prop] != '') {
                    value += `${prop.replace('#', '')} - ${sheets[player].Inventory[prop]}\n`;
                }
            }

            if (value == '') {
                value = 'The inventory is empty.';
            }
            else if (value.length > 1016) {
                return 'The inventory must be length less than or equal to 1024.';
            }

            embed.addField('**Inventory:**', `*\`\`\`${value}\`\`\`*`, false);
        }
        else if (type == 'Story') //story
        {
            if (sheets[player].About.Story == '') {
                embed.addField('**Story:**', '*No story.*', false);
            }
            else {
                if (sheets[player].About.Story.length > 1022) {
                    return 'The story must be length less than or equal to 1024.';
                }
                embed.addField('**Story:**', `*${sheets[player].About.Story}*`, false);
            }
        }
        else {
            return 'Session not found.';
        }

        return embed;
    }
    catch (err) {
        console.log(err);
        return '';
    }
}

function getXs(n, base, spaceNum) {
    const character = '•';
    let output = '';
    for (let i = 0; i < n; i++) {
        output += `${character}${' '.repeat(spaceNum)}`;
    }
    const length = ((base * (spaceNum + 1)) - spaceNum);
    return output.padEnd(length, ' ').substring(0, length);
}

function translate(synonyms, toSearch) {
    loop1:
    for (let prop0 in synonyms) {
        for (let prop1 in synonyms[prop0]) {
            if (synonyms[prop0][prop1].includes(toSearch)) {
                toSearch = prop1;
                break loop1;
            }
        }
    }

    return toSearch;
}

function getPlayerName(sheets, player, authorId) {
    if (player == 'p') {
        for (let prop in sheets) {
            if (sheets[prop].user_id.includes(authorId)) {
                player = prop;

                break;
            }
        }

    }
    return player;
}

function ThrowError(authorId, message, details) {
    try {
        var data = fs.readFileSync('errorPhrases.txt', 'utf8').split('\n');
        if (details) {
            return message.channel.send(`<@${authorId}>: ${math.pickRandom(data)} *- (${details})*`).catch(err => {
                return message.channel.send('Critical Error.');
            });
        }
        return message.channel.send(`<@${authorId}>: ${math.pickRandom(data)}`).catch(err => {
            return message.channel.send('Critical Error.');
        });
    }
    catch (err) {
        console.log(err);
        return message.channel.send('Critical Error.');
    }
}

client.login("");