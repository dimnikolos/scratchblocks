var scratchblocks2 = {};


if (!Array.prototype.indexOf) {
   Array.prototype.indexOf = function(item) {
      var i = this.length;
      while (i--) {
         if (this[i] === item) return i;
      }
      return -1;
   }
}


scratchblocks2._assert = function (bool) {
    if (!bool) {
        console.log("Assertion failed!");
        debugger;
    }
};


/* helper function for class name prefixes */
scratchblocks2._cls = function (name) {
    var assert = scratchblocks2._assert;
    var is_class = scratchblocks2._is_class;
    assert(is_class(name));
    return name; //return "-scratchblocks2-" + name;
};



scratchblocks2._classes = {
    "misc": [
        "container",
        "script",
        "empty",
    ],
    "shape": [
        "hat",
        "cap",
        "stack",
        "embedded",
        "reporter",
        "boolean",
        "string",
        "dropdown",
        "number",
        "number-dropdown",
        "custom-definition",
        "custom-arg",
        "outline",

        "cstart",
        "cmouth",
        "cwrap",
        "celse",
        "cend"
    ],
    "category": [
        "obsolete",

        "control",
        "custom",
        "events",
        "list",
        "looks",
        "motion",
        "operators",
        "pen",
        "sensing",
        "sound",
        "variables"
    ]
};

scratchblocks2._is_class = function (name) {
    var classes = scratchblocks2._classes;
    if (scratchblocks2._all_classes == undefined) {
        var all = [];
        for (clstype in classes) {
            all = all.concat(classes[clstype]);
        }
        scratchblocks2._all_classes = all;
    }
    return (scratchblocks2._all_classes.indexOf(name) > -1);
}


/* Render all matching elements in page to shiny scratch blocks.
 * Accepts a CSS-style selector as an argument, or a dictionary with tag/class
 * values. Examples:
 *
 *  scratchblocks2.parse("pre.blocks");
 *
 *  scratchblocks2.parse({
 *      containerTag: "pre",
 *      containerClass: "blocks",
 *  });
 */
scratchblocks2.parse = function (d) {
    var selector = "";
    var cls = scratchblocks2._cls;

    if ($.type(d) == "string") {
        selector = d;
    } else {
        // support same args as JSO's scratchBlocksPlugin
        if ("containerTag" in d)   selector += d["containerTag"];
        if ("containerClass" in d) selector += "."+d["containerClass"];
    }

    // find elements
    $(selector).each(function (i, el) {
        var $el = $(el);

        var code = $el.text();
        var scripts = scratchblocks2._render(code);

        $el.html("");
        $el.addClass(cls("container"));
        $.each(scripts, function (i, $script) {
            $el.append($script);
        });
    });
};


/* Render script code to a list of DOM elements, one for each script. */
scratchblocks2._render = function (code) {
    var cls = scratchblocks2._cls;
    var classes = scratchblocks2._classes;
    var assert = scratchblocks2._assert;

    var scripts = [];
    var $script;
    var $current;
    var nesting;

    var new_script = function() {
        if ($script != undefined && $script.length > 0) {
            console.log($script);
            scripts.push($script);
        }
        $script = $("<div>").addClass(cls("script"));
        $current = $script;
        nesting = 0;
    };
    new_script();

    var lines = code.split(/\n/);
    for (var i=0; i<lines.length; i++) {
        var line = lines[i];

        // TODO: comments
        // ignore them for now
        if (/^\/\//.test(line.trim())) {
            continue;
        }
        
        // empty lines separate stacks
        if (line.trim() == "") {
            new_script();
            continue;
        }

        $block = scratchblocks2._render_block(line, "stack");
        
        if ($block) {
            if ( $block.hasClass(cls("hat")) ||
                 $block.hasClass(cls("custom-definition")) ||
                 $block.hasClass(cls("reporter"))) {
                new_script();
            }
            
            if ($block.hasClass(cls("cstart"))) {
                var $cwrap = $("<div>").addClass(cls("cwrap"));
                $current.append($cwrap);
                $cwrap.append($block);
                
                var $cmouth = $("<div>").addClass(cls("cmouth"));
                $cwrap.append($cmouth);
                $current = $cmouth;

                // give $cwrap the color of $block
                $.each($block.attr("class").split(/\s+/), function(i, name) {
                    // TODO fix for cls() prefix
                    if (classes.category.indexOf(name) > -1) {
                        $cwrap.addClass(name);
                    }
                });

                if ($block.hasClass(cls("cap"))) {
                    $cwrap.addClass(cls("cap"));
                }

                nesting += 1;

            } else if ($block.hasClass(cls("celse"))) {
                if (nesting > 0) {
                    var $cwrap = $current.parent();
                    assert($cwrap.hasClass(cls("cwrap")));
                    
                    $cwrap.append($block);

                    var $cmouth = $("<div>").addClass(cls("cmouth"));
                    $cwrap.append($cmouth);
                    $current = $cmouth;
                } else {
                    $current.append($block);
                }

            } else if ($block.hasClass(cls("cend"))) {
                if (nesting > 0) {
                    var $cwrap = $current.parent();
                    assert($cwrap.hasClass(cls("cwrap")));
                    
                    $cwrap.append($block);
                    $current = $cwrap.parent();
                    nesting -= 1;
                } else {
                    $current.append($block);
                }
            } else {
                $current.append($block);
            }
        }
    }
    return scripts;
};


/* Render script code to DOM. */
scratchblocks2._render_block = function (code, kind) {
    var cls = scratchblocks2._cls;

    if (code.trim().length == 0 && kind == 'stack') {
        return;
    }

    // bracket helpers
    var BRACKETS = "([<)]>";
    var is_open_bracket = function (chr) {
        var bracket_index = BRACKETS.indexOf(chr);
        return (-1 < bracket_index && bracket_index < 3);
    };
    var is_close_bracket = function (chr) {
        return (2 < BRACKETS.indexOf(chr));
    };
    var get_matching_bracket = function (chr) {
        return BRACKETS[BRACKETS.indexOf(chr) + 3];
    };
    var is_lt_gt = function (code, index) {
        var chr = code[index];
        if (chr != "<" && chr != ">") {
            return false;
        }
        if (index == code.length) return;
        if (index == 0) return;
        for (var i=index+1; i<code.length; i++) {
            var chr = code[i];
            if (chr == " ") {
                // continue on...
            } else if (is_open_bracket(chr)) {
                // hold on a sec. this guy might be an innocuous lt/gt, and not
                // the bracket we suspected!
                break;
            } else {
                // nope, he's a bracket
                return false;
            }
        }
        for (var i=index-1; i>-1; i--) {
            var chr = code[i];
            if (chr == " ") {

            } else if (is_close_bracket(chr)) {
                break;
            } else {
                return false;
            }
        }
        
        // we got this far: he's okay! rescue him from bracketedness.
        return true;
    };
    var strip_brackets = function (code) {
        if (is_open_bracket(code[0])) {
            var bracket = code[0]; 
            if (code[code.length - 1] == get_matching_bracket(bracket)) {
                code = code.substr(0, code.length - 1);
            }
            code = code.substr(1);
        }
        return code;
    }

    // init vars
    if (kind == undefined) kind = "";
    var category = "";
    var bracket = "";
    
    // trim
    code = code.trim();

    // strip brackets
    var is_dropdown = false;
    if (is_open_bracket(code[0])) {
        bracket = code[0];
        code = strip_brackets(code);
    }

    // trim again
    if (bracket != "[") {
        code = code.trim();
    }

    // check kind
    if (bracket == "(" && /^(-?[0-9.]+( v)?)?$/.test(code)) {
        kind = "number";
    } else if (bracket == "[") {
        kind = "string";
    }

    // dropdowns for [string v] and number (123 v)
    if (kind == "number" || kind == "string") {
        if (/ v$/.test(code)) {
            is_dropdown = true;
            code = code.substr(0, code.length - 2);
            if (kind == "string") {
                kind = "dropdown";
            } else {
                kind = "number-dropdown";
            }
        }
    }
    
    // custom block definitions
    if (/^define/.test(code.trim())) {
        kind = "custom-definition"; 
        code = code.substr(6).trim();
    }

    // MAKE dom element
    if (kind == "stack" || kind == "hat" || kind == "custom-definition") {
        var $block = $("<div>");
    } else {
        var $block = $("<span>");
    }
    
    // give special classes colour
    if (kind == "custom-definition") {
        $block.addClass(cls("custom"));
    }

    
    // SPLIT into pieces
    var pieces = [];
    if (kind && kind != "stack" && kind != "custom-definition") {
        pieces = [code]; // don't bother splitting

        if (code.length == 0) {
            code = " "; // must have content to size correctly
            $block.addClass(cls("empty"));
        }
    } else {
        code = code.trim();

        var piece = "";
        var piece_bracket = "";
        var matching_bracket = "";
        var nesting = 0;

        for (var i=0; i<code.length; i++) {
            var chr = code[i];
            if (nesting > 0) {
                piece += chr;
                if (chr == piece_bracket && !is_lt_gt(code, i)) {
                    nesting += 1;
                } else if (chr == matching_bracket && !is_lt_gt(code, i)) {
                    nesting -= 1;
                    if (nesting == 0) {
                        pieces.push(piece);
                        piece = "";
                    }
                }
            } else {
                if (is_open_bracket(chr) && !is_lt_gt(code, i)) {

                    piece_bracket = chr;
                    matching_bracket = get_matching_bracket(chr)
                    nesting += 1;
                    if (piece) pieces.push(piece);
                    piece = "";
                }
                piece += chr;
            }
        }
        if (piece) pieces.push(piece);

        // check for variables
        if (bracket == "(" && pieces.length == 1 && !is_open_bracket(pieces[0][0])) {
            kind = "reporter";
            var category = "variables";
        }
    }

    // check for embedded blocks
    if (bracket == "<") {
        kind = "boolean";
        var category = "operators";
    } else if (kind == "") {
        kind = "embedded";
    }

    // add shape class
    $block.addClass(cls(kind));
    
    // block content
    if (pieces.length == 0) {
        // we didn't bother parsing the block into pieces!
        if (code.length == 0) {
            code = " "; // must have content to size correctly
            $block.addClass(cls("empty"));
        }
        pieces = [code];
        //$block.html(code);
    }

    
    // RENDARRR //
    var is_block = function (piece) {
        return piece.length > 1 && (
            is_open_bracket(piece[0]) || is_close_bracket(piece[0]));
    };

    // filter out block text & args
    var text = "";
    var args = [];
    for (var i=0; i<pieces.length; i++) {
        var piece = pieces[i];
        if (is_block(piece)) {
           args.push(piece);
        } else {
            text += piece;
        }
    }

    // render the pieces
    if (pieces.length == 1) {
        $block.html(code);
    } else if (kind == "custom-definition") { // custom block args
        $block.append("define");
        var $outline = $("<span>").addClass(cls("outline"));
        $block.append($outline);

        for (var i=0; i<pieces.length; i++) {
            var piece = pieces[i];
            if (is_block(piece)) {
                var $arg = $("<span>").addClass(cls("custom-arg"));
                if (piece[0] == "<") {
                    $arg.addClass(cls("boolean"));
                }
                $arg.html(strip_brackets(piece));
                $outline.append($arg);
            } else {
                $outline.append(piece);
            }
        }
    } else {
        for (var i=0; i<pieces.length; i++) {
            var piece = pieces[i];
            if (is_block(piece)) {
                $block.append(scratchblocks2._render_block(piece));
            } else {
                $block.append(piece);
            }
        }
    }

    // get category
    if (kind != "custom-definition") {
        // TODO custom blocks
        var classes = scratchblocks2._find_block(text, args);
        if (classes.length == 0) {
            // can't find the block!
            if (category != "") {
                $block.addClass(cls(category));
            } else {
                if (kind == "stack") {
                    $block.addClass(cls("custom"));
                } else if (!$block.hasClass(cls("empty"))) {
                    $block.addClass(cls("obsolete"));
                }
            }
        } else {
            $.each(classes, function (i, name) {
                $block.addClass(cls(name));
            });
        }
    }
    
    // cend blocks: hide "end" text
    if ($block.hasClass(cls("cend"))) {
        var content = $block.html();
        $block.html("").append($("<span>").html(content))
    }

    return $block;
};


/* Return information for a block, given its text. Uses args as hints. */
scratchblocks2._find_block = function (text, args) {
    var blocks = scratchblocks2.blocks;

    text = text.replace(/[ ,%?:]/g, "");
    text = text.toLowerCase();
    
    for (i=0; i<blocks.length; i++) {
        var block = blocks[i];
        if (block[0] == text) {
            var classes = [ block[1] ];
            if (block.length > 3) {
                classes = classes.concat(block.slice(3));
            }
            return classes;
        }
    }
    
    console.log("Missing block: ", text);

    return [];
};


/* The list of blocks. */
scratchblocks2.blocks = [
    // Motion //
    ["movesteps", "motion", ["%n"]],
    ["turncwdegrees", "motion", ["%n"]],
    ["turnccwdegrees", "motion", ["%n"]],
    ["pointindirection", "motion", ["%d"]],
    ["pointtowards", "motion", ["%m"]],
    ["gotoxy", "motion", ["%n", "%n"]],
    ["goto", "motion", ["%m"]],
    ["glidesecstoxy", "motion", ["%n", "%n", "%n"]],
    ["changexby", "motion", ["%n"]],
    ["setxto", "motion", ["%n"]],
    ["changeyby", "motion", ["%n"]],
    ["setyto", "motion", ["%n"]],
    ["ifonedgebounce", "motion", []],
    ["xposition", "motion", []],
    ["yposition", "motion", []],
    ["direction", "motion", []],
    ["setrotationstyle", "motion", []],

    // Events //
    ["whengreenflagclicked", "events", [], "hat"],
    ["whengfclicked", "events", [], "hat"],

    // Control //
    ["whenkeypressed", "control", ["%k"], "hat"],
    ["whenclicked", "control", ["%m"], "hat"],
    ["waitsecs", "control", ["%n"]],
    ["forever", "control", [], "cstart", "cap"],
    ["repeat", "control", ["%n"], "cstart"],
    ["broadcast", "control", ["%e"]],
    ["broadcastandwait", "control", ["%e"]],
    ["whenireceive", "control", ["%e"], "hat"],
    ["foreverif", "control", ["%b"], "cstart"],
    ["if", "control", ["%b"], "cstart"],
    ["ifthen", "control", ["%b"], "cstart"],
    ["else", "control", ["%b"], "celse"],
    ["end", "control", ["%b"], "cend"],
    ["waituntil", "control", ["%b"]],
    ["repeatuntil", "control", ["%b"], "cstart"],
    ["stopscript", "control", [], "cap"],
    ["stopall", "control", [], "cap"],

    // Looks //
    ["switchtobackground", "looks", ["%l"]],
    ["nextbackground", "looks", []],
    ["background#", "looks", []],
    ["changeeffectby", "looks", ["%g", "%n"]],
    ["seteffectto", "looks", ["%g", "%n"]],
    ["cleargraphiceffects", "looks", []],
    ["switchtocostume", "looks", ["%l"]],
    ["switchcostumeto", "looks", ["%l"]],
    ["switchbackdropto", "looks", ["%l"]],
    ["nextcostume", "looks", []],
    ["costume#", "looks", []],
    ["sayforsecs", "looks", ["%s", "%n"]],
    ["say", "looks", ["%s"]],
    ["thinkforsecs", "looks", ["%s", "%n"]],
    ["think", "looks", ["%s"]],
    ["changeeffectby", "looks", ["%g", "%n"]],
    ["seteffectto", "looks", ["%g", "%n"]],
    ["cleargraphiceffects", "looks", []],
    ["changesizeby", "looks", ["%n"]],
    ["setsizeto", "looks", ["%n"]],
    ["size", "looks", []],
    ["show", "looks", []],
    ["hide", "looks", []],
    ["gotofront", "looks", []],
    ["gobacklayers", "looks", ["%n"]],
    ["backdropname", "looks"],
    ["backdrop#", "looks"],
    ["switchbackgroundtoandwait", "looks", ["%l"]],
    ["nextbackdrop", "looks", []],
    ["turnvideo", "looks", []],
    ["setvideotransparencyto", "looks", []],

    // Sensing //
    ["askandwait", "sensing", ["%s"]],
    ["answer", "sensing", []],
    ["mousex", "sensing", []],
    ["mousey", "sensing", []],
    ["mousedown", "sensing", []],
    ["keypressed", "sensing", ["%k"]],
    ["resettimer", "sensing", []],
    ["timer", "sensing", []],
    ["of", "sensing", ["%a", "%m"]],
    ["loudness", "sensing", []],
    ["loud", "sensing", []],
    ["sensorvalue", "sensing", ["%H"]],
    ["sensor", "sensing", ["%h"]],
    ["touching", "sensing", ["%m"]],
    ["touchingcolor", "sensing", ["%C"]],
    ["coloristouching", "sensing", ["%C", "%C"]],
    ["askandwait", "sensing", ["%s"]],
    ["answer", "sensing", []],
    ["mousex", "sensing", []],
    ["mousey", "sensing", []],
    ["mousedown", "sensing", []],
    ["keypressed", "sensing", ["%k"]],
    ["distanceto", "sensing", ["%m"]],
    ["resettimer", "sensing", []],
    ["timer", "sensing", []],
    ["of", "sensing", ["%a", "%m"]],
    ["loudness", "sensing", []],
    ["loud", "sensing", []],
    ["sensorvalue", "sensing", ["%H"]],
    ["sensor", "sensing", ["%h"]],

    // Sound //
    ["playsound", "sound", ["%S"]],
    ["playsounduntildone", "sound", ["%S"]],
    ["stopallsounds", "sound", []],
    ["playdrumforbeats", "sound", ["%D", "%n"]],
    ["restforbeats", "sound", ["%n"]],
    ["playnoteforbeats", "sound", ["%N", "%n"]],
    ["setinstrumentto", "sound", ["%I"]],
    ["changevolumeby", "sound", ["%n"]],
    ["setvolumeto", "sound", ["%n"]],
    ["volume", "sound", []],
    ["changetempoby", "sound", ["%n"]],
    ["settempotobpm", "sound", ["%n"]],
    ["tempo", "sound", []],

    // Operators //
    ["+", "operators", ["%n", "%n"]],
    ["-", "operators", ["%n", "%n"]],
    ["*", "operators", ["%n", "%n"]],
    ["/", "operators", ["%n", "%n"]],
    ["pickrandomto", "operators", ["%n", "%n"]],
    ["<", "operators", ["%s", "%s"]],
    ["=", "operators", ["%s", "%s"]],
    [">", "operators", ["%s", "%s"]],
    ["and", "operators", ["%b", "%b"]],
    ["or", "operators", ["%b", "%b"]],
    ["not", "operators", ["%b"]],
    ["join", "operators", ["%s", "%s"]],
    ["letterof", "operators", ["%n", "%s"]],
    ["lengthof", "operators", ["%s"]],
    ["mod", "operators", ["%n", "%n"]],
    ["round", "operators", ["%n"]],
    ["of", "operators", ["%f", "%n"]],
    ["ablockwithcolorandcolor", "operators", ["%C", "%c"]],

    // Pen //
    ["clear", "pen", []],
    ["clear", "pen", []],
    ["pendown", "pen", []],
    ["penup", "pen", []],
    ["setpencolorto", "pen", ["%c"]],
    ["changepencolorby", "pen", ["%n"]],
    ["setpencolorto", "pen", ["%n"]],
    ["changepenshadeby", "pen", ["%n"]],
    ["setpenshadeto", "pen", ["%n"]],
    ["changepensizeby", "pen", ["%n"]],
    ["setpensizeto", "pen", ["%n"]],
    ["stamp", "pen", []],

    // Variables //
    ["showvariable", "variables", ["%v"]],
    ["hidevariable", "variables", ["%v"]],
    ["changeby", "variables", ["%v", "%n"]],
    ["setto", "variables", ["%v", "%s"]],

    // List //
    ["addto", "list", ["%s", "%L"]],
    ["deleteof", "list", ["%y", "%L"]],
    ["insertatof", "list", ["%s", "%i", "%L"]],
    ["replaceitemofwith", "list", ["%i", "%L", "%s"]],
    ["itemof", "list", ["%i", "%L"]],
    ["lengthof", "list", ["%L"]],
    ["contains", "list", ["%L", "%s"]],

    // Motor //
    ["motoronforsecs", "motor", ["%n"]],
    ["motoron", "motor", []],
    ["motoroff", "motor", []],
    ["motorpower", "motor", ["%n"]],
    ["motordirection", "motor", ["%W"]],
];