$(document).ready(function () {
    if (load_game()){
        $("#start-continue").show()
    }
    randomize_beers()
    const button = $(".actionbutton")
    button.on("click", function () {
        do_action(this.id)
    });
    let hold;
    button.on('mousedown touchstart', function () {
        $("#bottomtext").text("")
        if(this.id.split("-")[1]==="select"){
            holdplayer = 0
        }
        let elem = this
        hold = setTimeout(function () {
            set_hold(elem.id)
        }, 1000)
    });
    button.on('mouseup touchend mouseout', function () {
        clearTimeout(hold)
    });
    $(".selectables > .beerspot").on("click", function () {
        hit_beer(this.id)
    });
});

let teams = {
    "A": false,
    "B": false
}
let lastmenu = "StartupActions"
let currentmenu = lastmenu

let holdplayer = 0
let current_player = 0
let selfhit = false

let beerlines = {
    "A": [1, 1, 1, 1, 1, 1, 1, 1],
    "B": [1, 1, 1, 1, 1, 1, 1, 1],
    "S": [1, 1, 1, 1, 1, 1, 1, 1],
    "Ap": [0,0,0,0,0,0,0,0],
    "Bp": [0,0,0,0,0,0,0,0]
}

let actions = []

let score = []
let players = {}


let playerdef = {"hits": 0, "self": 0, "flips": 0}

function do_action(button) {
    let menu = button.split("-")[0]
    let button_name = button.split("-")[1]
    let button_id = button.split("-")[2]
    switch (button_name) {
        case "hit":
            selfhit=false
            set_menu("PlayerActions")
            break;
        case "selfhit":
            selfhit=true
            set_menu("PlayerActions")
            break;
        case "select":
            current_player = button_id
            clone_to_beerline(get_team(current_player, selfhit), "S")
            update_beerline("S")
            set_menu("BeerActions")
            break;
        case "ok":
            if (!set_action("hit")){
                break;
            }
            save_game()
            clone_to_beerline("S", get_team(current_player, selfhit))
            load_from_actions()
            clone_to_beerline(get_team(current_player, selfhit), "S")
            update_beerline("S", true)
            if (holdplayer === 0){
                set_menu("MainActions")
            }
            break;
        case "back":
            set_menu("MainActions")
            $("#bottomtext").text("")
            holdplayer = 0
            break;
        case "tolast":
            set_menu(lastmenu)
            break;
        case "fullback":
            set_menu("StartupActions")
            break;
        case "stats":
            set_menu("StatsActions")
            break;
        case "new":
            init_game()
            clear_inputs("Joukkue 1")
            set_menu("SetTeamActions")
            break;
        case "continue":
            load_game()
            load_from_actions()
            set_menu("WaitActions")
            break;
        case "teamok":
            set_team_info()
            break;
        case "undo":
            set_menu("UndoActions")
            break;
        case "doundo":
            let lastact = actions.pop()
            save_game()
            load_from_actions()
            if (!lastact){
                set_menu("StartupActions")
                break
            } else if (lastact["type"] === "start"){
                set_menu("WaitActions")
                break
            } else if (lastact["type"] === "win") {
                set_menu("MainActions")
                break
            }
            set_menu(lastmenu)
            break;
        case "startround":
            init_round()
            set_action("start")
            set_menu("MainActions")
            break;
        case "endround":
            set_menu("EndActions")
            break;
        case "win":
            set_action("win", button_id)
            set_menu("WaitActions")
            break
        default:
            console.log(button)
            alert('Default case');
    }
}

function set_action(type, param=false){
    switch (type) {
        case "hit":
            let act = {"type": type, "p": current_player, "b": [0, 0, 0, 0, 0, 0, 0, 0], "timestamp": Date.now()}
            let foundactions = false
            for (let b = 0; b < 8; b++) {
                if (beerlines[get_team(current_player, selfhit)][b] !== beerlines["S"][b] && beerlines["S"][b] !== 0) {
                    foundactions = true
                    act["b"][b] = beerlines["S"][b]
                    if (selfhit){
                        act["b"][b] = -beerlines["S"][b]
                    } else {
                        act["b"][b] = -beerlines["S"][b]
                    }
                    beerlines[get_team(current_player, selfhit)+"p"][b] = current_player
                }
            }
            if (foundactions) {
                actions.push(act)
                return true
            }
            return false
        case "win":
            actions.push({"type": type, "team": param, "timestamp": Date.now()})
            break
        default:
            actions.push({"type": type, "timestamp": Date.now()})
    }
}

function set_hold(button) {
    let menu = button.split("-")[0]
    let button_name = button.split("-")[1]
    let button_id = button.split("-")[2]
    if(button_name === "select"){
        holdplayer = button_id
        console.log(teams)
        let holdname = teams[get_team(holdplayer)]["players"][(holdplayer-1)%3]
        $("#bottomtext").text("Jatkuva syöttö pelaajalle: " + holdname + "!")
    }

}

function init_game(){
    teams = {"A": false, "B": false}
    init_round()
}

function init_round(){
    selfhit = false
    beerlines = {
        "A": [1, 1, 1, 1, 1, 1, 1, 1],
        "B": [1, 1, 1, 1, 1, 1, 1, 1],
        "S": [1, 1, 1, 1, 1, 1, 1, 1],
        "Ap": [0,0,0,0,0,0,0,0],
        "Bp": [0,0,0,0,0,0,0,0]
    }
    update_beerlines()
}

function set_playerbuttons(){
    for (let p = 1; p <= 6; p++) {
        let pname = teams[get_team(p)]["players"][(p-1)%3]
        $("#player-select-" + p).text(pname)
    }
}

function load_from_actions(){
    init_game()
    load_game()
    set_playerbuttons()
    for (let a = 0; a < actions.length; a++){
        switch (actions[a]["type"]){
            case "hit":
                for (let b = 0; b < 8; b++) {
                    if (actions[a]["b"][b] > 0){
                        beerlines[get_team(actions[a]["p"], false)][b] = actions[a]["b"][b]
                        beerlines[get_team(actions[a]["p"], false)+"p"][b] = actions[a]["p"]
                    } else if (actions[a]["b"][b] < 0){
                        beerlines[get_team(actions[a]["p"], true)][b] = - actions[a]["b"][b]
                        beerlines[get_team(actions[a]["p"], true)+"p"][b] = actions[a]["p"]
                    }
                }
                break
            case "start":
                set_menu("MainActions")
                break
            case "win":
                set_menu("WaitActions")
                break
        }
        update_beerlines()
    }
}

function save_game(){
    localStorage.setItem("actions", JSON.stringify(actions));
    localStorage.setItem("teams", JSON.stringify(teams));
}

function load_game(){
    let a = JSON.parse(localStorage.getItem("actions"));
    let t = JSON.parse(localStorage.getItem("teams"));
    if (t && a){
        actions = a
        teams = t
        return true
    }
    return false
}
function randomize_beers() {
    let teamids = ["A", "B"]
    let tr = Math.round(Math.random())
    for (let b = 0; b < 8; b++) {
        for (let t = 0; t < 2; t++) {
            let r = Math.random()
            if (r < 0.01) {
                beerlines[teamids[t]][b] = 3
            } else if (r < 0.6) {
                if (tr === t && Math.random() < 0.2) {
                    beerlines[teamids[t]][b] = 2
                } else {
                    beerlines[teamids[t]][b] = 0
                }
            } else {
                beerlines[teamids[t]][b] = 1
            }
        }
    }
    update_beerlines()
}


function set_team_info() {
    let team = "A"
    if (teams["A"]) {
        team = "B"
    }
    teams[team] = {
        "name": $("#team-name-input").val(),
        "players": [$("#player-input-1").val(), $("#player-input-2").val(), $("#player-input-3").val()]
    }
    if (team === "A") {
        clear_inputs("Joukkue 2")
    } else {
        save_game()
        set_playerbuttons()
        set_menu("WaitActions")
    }
}

function clear_inputs(title) {
    $("#team-name-input").val("")
    $("#player-input-1").val("")
    $("#player-input-2").val("")
    $("#player-input-3").val("")
    $("#SetTeamActions").find(".menutitle").text(title)
}

function set_menu(menuid) {
    lastmenu = currentmenu
    currentmenu = menuid
    $(".menu").css("display", "none");
    $("#" + menuid).css("display", "flex");
}

function hit_beer(beer) {
    let beerindex = beer[2] - 1
    if (beerlines["S"][beerindex] === 0) {
        return
    }
    beerlines["S"][beerindex] += 1;
    if (beerlines["S"][beerindex] > 3) {
        beerlines["S"][beerindex] = 1
    }
    update_beerline("S")
}

function get_team(n, own = true) {
    if (n <= 3) {
        if (own) {
            return "A"
        } else {
            return "B"
        }
    } else {
        if (own) {
            return "B"
        } else {
            return "A"
        }
    }
}

function clone_to_beerline(from, to) {
    for (let b = 0; b < 8; b++) {
        beerlines[to][b] = beerlines[from][b];
    }
}

function update_beerlines(f=false) {
    update_beerline("A", f)
    update_beerline("B", f)
    update_beerline("S", f)
}

function update_beerline(team, f=false) {
    let line = $("#bl" + team).children().toArray();
    if (team === "A") {
        line = line.reverse()
    }
    for (let b = 0; b < 8; b++) {
        $(line[b]).children().hide()
        switch (beerlines[team][b]) {
            case 0:
                $(line[b]).find(".grass").show()
                break
            case 1:
                $(line[b]).find(".beer").show()
                break
            case 2:
                $(line[b]).find(".hit").show()
                if (team !== "S") {
                    beerlines[team][b] = 0;
                } else if (f){
                    $(line[b]).find(".hit").hide()
                    $(line[b]).find(".grass").show()
                    beerlines[team][b] = 0;
                }
                break
            case 3:
                $(line[b]).find(".flip").show()
                break
        }
        $(line[b]).find(".actor").show()

        if (team !== "S") {
            let p = beerlines[team + "p"][b]
            if (p !== 0) {
                $(line[b]).find(".actor").text(teams[get_team(p)]["players"][(p - 1) % 3])
            } else {
                $(line[b]).find(".actor").text("")
            }
        }
    }
}