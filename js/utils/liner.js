define(function () {
    function Liner(h) {

        var module = {};

        var _state = "normal"; // 'dialogue'

        /**
         * Split single line of text into lines
         * @param text - text to split
         * @param max - maximum characters per line
         * @param index - character index in text (for navigation to the line in the editor)
         * @param token - token type
         */
        var split_text = function (text, max, index, token) {
            var  removedSections = []
            var filteredText = text.replace(/\|\/?col.*?\|/g, function(match, offset, originalText) {
                removedSections.push({
                    content: match,
                    startIndex: offset,
                    length: match.length
                });
                return "";
            });
        
            var lines = [];
        
            if (filteredText.length <= max) {
                lines.push(h.create_line({
                    type: token.type,
                    token: token,
                    text: text,
                    start: index,
                    end: index + text.length - 1
                }));
            } else {
                var pointer = filteredText.substr(0, max + 1).lastIndexOf(" ");
                var breakPointFound;
        
                if (pointer === -1) {
                    pointer = max - 1;
                    breakPointFound = false;
                } else {
                    breakPointFound = true;
                }
        
                var skipWhiteSpaceIfNeeded = breakPointFound ? 1 : 0;
        
                var adjustedPointer = adjustPointerForOriginalText(pointer, removedSections);

                lines.push(h.create_line({
                    type: token.type,
                    token: token,
                    text: text.substr(0, adjustedPointer),
                    start: index,
                    end: index + adjustedPointer
                }));

                lines = lines.concat(split_text(text.substr(adjustedPointer + skipWhiteSpaceIfNeeded), max, index + adjustedPointer, token));
            }
            return lines;
        
            function adjustPointerForOriginalText(pointer, removedSections) {
                var adjustment = 0;
                for (var i = 0; i < removedSections.length; i++) {
                    if (removedSections[i].startIndex <= pointer+adjustment) {
                        adjustment += removedSections[i].length;
                    } else {
                        break;
                    }
                }
                return pointer + adjustment;
            }
        };

        var split_token = function (token, max) {
            token.lines = split_text(token.text || "", max, token.start, token);
        };

        var default_breaker = function (index, lines, cfg) {
            var CONTD = cfg.text_contd || "(CONT'D)";
            var MORE = cfg.text_more || "(MORE)";

            for (var before = index - 1; before && !(lines[before].text); before--) {
            }
            for (var after = index + 1; after < lines.length && !(lines[after].text); after++) {
            }

            // possible break is after this token
            var token_on_break = lines[index];

            var token_after = lines[after];
            var token_before = lines[before];

            if (token_on_break.is("scene_heading") && token_after && !token_after.is("scene_heading")) {
                return false;
            } else if (token_after && token_after.is("transition") && !token_on_break.is("transition")) {
                return false;
            }

            // action block 1,2 or 3 lines.
            // don't break unless it's the last line
            else if (token_on_break.is("action") &&
                token_on_break.token.lines.length < 4 &&
                token_on_break.token.lines.indexOf(token_on_break) !== token_on_break.token.lines.length - 1) {
                return false;
            }

            // for and more lines
            // break on any line different than first and penultimate
            // ex.
            // aaaaaaaaa <--- don't break after this line
            // aaaaaaaaa <--- allow breaking after this line
            // aaaaaaaaa <--- allow breaking after this line
            // aaaaaaaaa <--- don't break after this line
            // aaaaaaaaa <--- allow breaking after this line
            else if (token_on_break.is("action") &&
                token_on_break.token.lines.length >= 4 &&
                (token_on_break.token.lines.indexOf(token_on_break) === 0 ||
                    token_on_break.token.lines.indexOf(token_on_break) === token_on_break.token.lines.length - 2)) {
                return false;
            } else if (cfg.split_dialogue && token_on_break.is("dialogue") && token_after && token_after.is("dialogue") && token_before.is("dialogue") && !(token_on_break.dual)) {
                var new_page_character;
                for (var character = before; lines[character].type !== "character"; character--) {
                }
                lines.splice(index, 0, h.create_line({
                    type: "parenthetical",
                    text: MORE,
                    start: token_on_break.start,
                    end: token_on_break.end,
                    token: token_on_break.token
                }), new_page_character = h.create_line({
                    type: "character",
                    text: lines[character].text.trim() + " " + (lines[character].text.indexOf(CONTD) !== -1 ? "" : CONTD),
                    start: token_after.start,
                    end: token_after.end,
                    token: token_on_break.token
                }));

                if (lines[character].right_column) {
                    var dialogue_on_page_length = index - character;
                    var right_lines_on_this_page = lines[character].right_column.slice(0, dialogue_on_page_length).concat([
                            h.create_line({
                                type: "parenthetical",
                                text: MORE,
                                start: token_on_break.start,
                                end: token_on_break.end,
                                token: token_on_break.token
                            })
                        ]),
                        right_lines_for_next_page = [h.create_line({
                            type: "character",
                            text: right_lines_on_this_page[0].text.trim() + " " + (right_lines_on_this_page[0].text.indexOf(CONTD) !== -1 ? "" : CONTD),
                            start: token_after.start,
                            end: token_after.end,
                            token: token_on_break.token
                        })
                        ].concat(lines[character].right_column.slice(dialogue_on_page_length));

                    lines[character].right_column = right_lines_on_this_page;
                    if (right_lines_for_next_page.length > 1) {
                        new_page_character.right_column = right_lines_for_next_page;
                    }
                }

                return true;
            } else if (lines[index].is_dialogue() && lines[after] && lines[after].is("dialogue", "parenthetical")) {
                return false; // or break
            }
            return true;
        };

        var break_lines = function (lines, max, breaker, cfg) {
            while (lines.length && !(lines[0].text)) {
                lines.shift();
            }

            var s = max;
            var p, internal_break = 0;

            for (var i = 0; i < lines.length && i < max; i++) {
                if (lines[i].type === "page_break") {
                    internal_break = i;
                }
            }

            if (!internal_break) {
                if (lines.length <= max) {
                    return lines;
                }
                do {
                    for (p = s - 1; p && !(lines[p].text); p--) {
                    }
                    s = p;
                } while (p && !breaker(p, lines, cfg));
                if (!p) {
                    p = max;
                }
            } else {
                p = internal_break - 1;
            }
            var page = lines.slice(0, p + 1);

            // if scene is not finished (next not empty token is not a heading) - add (CONTINUED)
            var next_page_line_index = p + 1,
                next_page_line = null,
                scene_split = false;
            while (next_page_line_index < lines.length && next_page_line === null) {
                if (lines[next_page_line_index].type !== "separator" && lines[next_page_line_index].type !== "page_break") {
                    next_page_line = lines[next_page_line_index];
                }
                next_page_line_index++;
            }

            if (next_page_line && next_page_line.type !== "scene_heading") {
                scene_split = true;
            }

            page.push(h.create_line({
                type: "page_break",
                scene_split: scene_split
            }));
            var append = break_lines(lines.slice(p + 1), max, breaker, cfg);
            return page.concat(append);
        };

        var fold_dual_dialogue = function (lines) {
            var any_unfolded_dual_dialogue_exists = true;

            var get_first_unfolded_dual_left = function () {
                for (var i = 0; i < lines.length; i++) {
                    if (lines[i].token &&
                        lines[i].token.type === "character" &&
                        lines[i].token.dual === "left" &&
                        lines[i].right_column === undefined) {
                        return i;
                    }
                }
                return -1;
            };
            var get_first_unfolded_dual_right_index_from = function (index) {
                for (var i = index; i < lines.length; i++) {
                    if (lines[i].token &&
                        lines[i].token.type === "character" &&
                        lines[i].token.dual === "right") {
                        return i;
                    }
                }
                return -1;
            };
            var count_dialogue_tokens = function (right_index) {
                var result = 0;
                while (lines[right_index] && lines[right_index].is_dialogue()) {
                    result++;
                    right_index++;
                }
                result++; // collect separator after right dialogue
                return result;
            };
            var fold_dual_dialogue = function (left_index, right_index) {
                var dialogue_tokens = count_dialogue_tokens(right_index);
                var right_lines = lines.splice(right_index, dialogue_tokens);
                lines[left_index].right_column = right_lines;
            };

            while (any_unfolded_dual_dialogue_exists) {
                var left_index = get_first_unfolded_dual_left();
                var right_index = left_index === -1 ? -1 : get_first_unfolded_dual_right_index_from(left_index);
                any_unfolded_dual_dialogue_exists = left_index !== -1 && right_index !== -1;
                if (any_unfolded_dual_dialogue_exists) {
                    fold_dual_dialogue(left_index, right_index);
                }
            }

        };


        module.line = function (tokens, cfg) {

            var lines = [],
                global_index = 0;

            _state = "normal";

            tokens.forEach(function (token) {
                var max = (cfg.print[token.type] || {}).max || cfg.print.action.max;

                if (token.dual) {
                    max *= cfg.print.dual_max_factor;
                }

                split_token(token, max);

                if (token.is("scene_heading") && lines.length) {
                    token.lines[0].number = token.number;
                }

                token.lines.forEach(function (line, index) {
                    line.local_index = index;
                    line.global_index = global_index++;
                    lines.push(line);
                });
            });

            fold_dual_dialogue(lines);
            lines = break_lines(lines, cfg.print.lines_per_page, cfg.lines_breaker || default_breaker, cfg);

            return lines;
        };

        return module;

    }

    return Liner;
});