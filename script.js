$(document).ready(function () {
    $("#top").hide()
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
    $("#mid_thing").on("click", function () {
        flip_teams()
    });
    setInterval(update_clock, 100)
});

function update_clock(){
    let now_time = Date.now()
    let diffTime = Math.abs(now_time - start_time);
    let hours = Math.floor(diffTime / (1000 * 60 * 60)).toString().padStart(2,"0");
    let minutes = (Math.floor(diffTime / (1000 * 60))%60).toString().padStart(2,"0");
    let seconds = (Math.floor(diffTime / (1000))%60).toString().padStart(2,"0");
    $("#hour0").text(hours[0])
    $("#hour1").text(hours[1])
    $("#min0").text(minutes[0])
    $("#min1").text(minutes[1])
    $("#sec0").text(seconds[0])
    $("#sec1").text(seconds[1])

}

function flip_teams(){
    if (teams[0]["side"] === LEFT){
        teams[0]["side"] = RIGHT
        teams[1]["side"] = LEFT
    } else {
        teams[0]["side"] = LEFT
        teams[1]["side"] = RIGHT
    }
    update_beerlines()
    set_top()
}



const texts = {
    "team": {"fi": "Joukkue", "en": "Team"},
    "chose_player": {"fi": "Valitsit pelaajan", "en": "You chose player"},
    "round_start": {"fi": "Erä alkoi", "en": "Round started"},
    "won": {"fi": "voitti erän!", "en": "won the round!"},
}
let lang = "fi"

let lastmenu = "StartupActions"
let currentmenu = lastmenu

let holdplayer = 0
let current_player = 0

let selfhit = false
let start_time = Date.now()

let game_id = Date.now()

const UP = 1
const FALLEN = 0
const FLIPPED = -1
const LEFT = 0
const RIGHT = 1



let teams = [
    {"ready": false, "teamname": "Team A", "players": ["Player 1", "Player 2", "Player 3"], "score": 0, "side": LEFT, "beers":
    [{"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}]},
    {"ready": false, "teamname": "Team B", "players": ["Player 1", "Player 2", "Player 3"], "score": 0, "side": RIGHT, "beers":
    [{"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}]}
]
let editing = {}
let actions = []
let feed = []


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
            set_edit(get_team(current_player, selfhit))
            update_beerline(-1)
            $(".menulogtext").text(texts["chose_player"][lang] + " " +get_player(current_player))
            set_menu("BeerActions")
            break;
        case "ok":
            if (!set_action("hit")){
                break;
            }
            get_edit(get_team(current_player, selfhit))
            save_game()
            update_beerlines()
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
            game_id = Date.now().toString()
            init_game()
            save_game()
            clear_inputs(texts["team"][lang]+" 1")
            set_menu("SetTeamActions")
            break;
        case "continue":
            load_game()
            load_from_actions()
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
    let action;
    switch (type) {
        case "hit":
            action = {"type": type, "player": current_player, "selfhit": selfhit, "beers": [], "timestamp": Date.now()}
            let t = get_team(current_player, selfhit)
            for (let b = 0; b < teams[t]["beers"].length; b++ ){
                if (teams[t]["beers"][b]["state"] !== editing["beers"][b]["state"]){
                    action["beers"].push({"beer": b, "state": editing["beers"][b]["state"]})
                }

            }
            if (action["beers"].length > 0){
                actions.push(action)
                update_feed(action)
                return true
            }
            return false
        case "win":
            action = {"type": type, "team": param, "timestamp": Date.now()}
            actions.push(action)
            update_feed(action)
            break
        default:
            action = {"type": type, "timestamp": Date.now()}
            actions.push(action)
            update_feed(action)
            break
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
    teams = [
        {"ready": false, "teamname": "Team A", "players": ["Player 1", "Player 2", "Player 3"], "score": 0, "side": LEFT, "beers":
        [{"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}]},
        {"ready": false, "teamname": "Team B", "players": ["Player 1", "Player 2", "Player 3"], "score": 0, "side": RIGHT, "beers":
        [{"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}]}
    ]
    actions = []
    init_round()
}

function init_round(){
    for (let t = 0; t < teams.length; t++ ){
        for (let b = 0; b < teams[t]["beers"].length; b++ ){
            teams[t]["beers"][b] = {"state": UP, "player": null, "new": false}
        }
    }
    selfhit = false
    update_beerlines()
}

function set_top(){
    $("#top").show()
    for (let t = 0; t < teams.length; t++ ){
        if (teams[t]["side"] === LEFT){
            $("#left_team_name").text(teams[t]["teamname"])
            $("#left_team_score").text(teams[t]["score"])
            $("#left_team_players").text(teams[t]["players"][0] + ", " + teams[t]["players"][1] + ", " + teams[t]["players"][2])
        } else {
            $("#right_team_name").text(teams[t]["teamname"])
            $("#right_team_score").text(teams[t]["score"])
            $("#right_team_players").text(teams[t]["players"][0] + ", " + teams[t]["players"][1] + ", " + teams[t]["players"][2])
        }
    }
}

function set_playerbuttons(){
    console.log(teams)
    for (let p = 0; p < 6; p++) {
        $("#player-select-" + p).text(get_player(p))
    }
}

function load_from_actions(){
    init_game()
    load_game()
    init_round()
    console.log(actions)
    $("#feed").html("")
    $("#feed2").html("")
    teams[0]["score"] = 0
    teams[1]["score"] = 0
    set_playerbuttons()
    for (let a = 0; a < actions.length; a++){
        switch (actions[a]["type"]){
            case "hit":
                let team = get_team(actions[a]["player"],actions[a]["selfhit"])
                for (let b = 0; b < actions[a]["beers"].length; b++ ) {
                    let beer = actions[a]["beers"][b]
                    teams[team]["beers"][beer["beer"]]["state"] = beer["state"]
                    teams[team]["beers"][beer["beer"]]["player"] = actions[a]["player"]
                }

                update_feed(actions[a])
                break
            case "start":
                set_menu("MainActions")
                start_time = actions[a]["timestamp"]
                init_round()
                update_feed(actions[a])
                break
            case "win":
                set_menu("WaitActions")
                teams[actions[a]["team"]]["score"] += 1
                update_feed(actions[a])
                start_time = actions[a]["timestamp"]
                break
        }
    }
    update_beerlines()
    set_top()
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
    console.log(teams)
    let possible_news = [[],[]]
    for (let t = 0; t < teams.length; t++ ){
        teams[t]["players"] = ["","",""]
        console.log(teams[t]["beers"])
        for (let b = 0; b < teams[t]["beers"].length; b++ ){
            let r = Math.random()
            if (r < 0.6) {
                if (Math.random() < 0.1) {
                    teams[t]["beers"][b]["state"] = FLIPPED
                } else {
                    teams[t]["beers"][b]["state"] = FALLEN
                }
                possible_news[t].push(b)
            } else {
                teams[t]["beers"][b]["state"] = UP
            }
        }
    }
    let last_team = Math.round(Math.random())
    if (possible_news[last_team].length === 0){
        last_team = (last_team -1)*-1
    }
    if (possible_news[last_team].length > 0) {
        let last = Math.ceil(Math.random() * 2.3)
        let news = []
        for (let l = 0; l < last; l++) {
            news.push(possible_news[last_team][Math.floor(Math.random()*possible_news[last_team].length)])
        }
        for (let n = 0; n < news.length; n++) {
            teams[last_team]["beers"][news[n]]["new"] = true

        }
    }
    update_beerlines()
}


function set_team_info() {
    let team = 0
    console.log(teams[0]["ready"])
    if (teams[0]["ready"]) {
        team = 1
    }
    teams[team]["ready"] = true
    teams[team]["teamname"] = $("#team-name-input").val()
    teams[team]["players"] = [$("#player-input-1").val(), $("#player-input-2").val(), $("#player-input-3").val()]

    if (team === 0) {
        clear_inputs(texts["team"][lang]+" 2")
    } else {
        save_game()
        set_playerbuttons()
        set_menu("WaitActions")
        set_top()
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

function hit_beer(b) {
    let bi = parseInt(b[2])
    switch (editing["beers"][bi]["state"]){
        case FALLEN:
            if (editing["beers"][bi]["new"]){
                editing["beers"][bi]["state"] = FLIPPED
                editing["beers"][bi]["new"] = false
            } else {
                return
            }
            break
        case UP:
            editing["beers"][bi]["state"] = FALLEN
            editing["beers"][bi]["new"] = true
            break
        case FLIPPED:
            editing["beers"][bi]["state"] = UP
            editing["beers"][bi]["new"] = false
            break
    }
    update_beerline(-1)
}

function get_player(id){
    return teams[Math.floor(id/3)]["players"][id%3]
}

function get_team(p, invert=false){
    let team = Math.floor(p/3)
    if (invert){
        team = (team-1)*-1
    }
    return team
}

function set_edit(t){
    editing = {
        "ready": teams[t]["ready"],
        "teamname": teams[t]["teamname"],
        "players": teams[t]["players"],
        "side": teams[t]["side"],
        "score": teams[t]["score"],
        "beers": []
    }
    for (let b = 0; b < teams[t]["beers"].length; b++ ) {
        editing["beers"][b] = {
            "state": teams[t]["beers"][b]["state"],
            "player": teams[t]["beers"][b]["player"],
            "new": false,
        }
    }
}

function get_edit(t){
    for (let b = 0; b < teams[t]["beers"].length; b++ ) {
        teams[0]["beers"][b]["new"] = false
        teams[1]["beers"][b]["new"] = false
        if (teams[t]["beers"][b]["state"] !== editing["beers"][b]["state"]){
            teams[t]["beers"][b]["state"] = editing["beers"][b]["state"]
            teams[t]["beers"][b]["player"] = current_player
            teams[t]["beers"][b]["new"] = true
        }
    }
}

function update_feed(action, blink=false){
    let feedline = "<div class='feedline'>"
    let feedicon;
    console.log(action)
    switch (action["type"]){
        case "hit":
            let beers = ""
            let t = get_team(action["player"], action["selfhit"])
            for (let b = 0; b < teams[t]["beers"].length; b++ ) {
                console.log("?")
                let in_act = false
                let state = teams[t]["beers"][b]["state"]
                for (let ab = 0; ab < action["beers"].length; ab++ ){
                    if (b === action["beers"][ab]["beer"]) {
                        state = action["beers"][ab]["state"]
                        in_act = true
                        break
                    }
                }
                beers += "<img "
                if (!in_act){
                    beers += "class='faded' "
                }
                beers += "src='img/"
                switch (state) {
                    case UP:
                        beers += "beer.png'>"
                        break
                    case FALLEN:
                        if (in_act) {
                            beers += "hit.png'>"
                        } else {
                            beers += "grass.png'>"
                        }
                        break
                    case FLIPPED:
                        beers += "flip.png'>"
                        break
                }
            }
            feedicon = "<img class='feedicon' src='img/frisbee.png'>"
            if (action["selfhit"]) {
                feedicon = "<img class='feedicon' src='img/selfhit.png'>"
            }
            let player = "<div class='feedplayer'>"+get_player(action["player"])+"</div>"
            feedline += get_time_div(action.timestamp) + player+feedicon+"<div class='feedbeer'>"+beers+"</div>"
            $("#feed").append(feedline)
            $("#feed2").append(feedline)
            break
        case "start":
            feedicon = "<img class='feedicon' src='img/start.png'>"
            feedline += get_time_div(action.timestamp, false) + feedicon + "<div class='feedtext'>" + texts["round_start"][lang] + "</div>"
            $("#feed").append(feedline)
            $("#feed2").append(feedline)
            break
        case "win":
            feedicon = "<img class='feedicon' src='img/win.png'>"
            feedline += get_time_div(action.timestamp) + feedicon  + "<div class='feedtext'>" + texts["team"][lang] + " " + teams[action["team"]]["teamname"] + " " + texts["won"][lang] + "</div>"
            $("#feed").append(feedline)
            $("#feed2").append(feedline)
            break

    }
}


function get_time_div(timestamp, from_start=true){
    let hours
    let minutes
    let seconds
    if (from_start){
        let diffTime = Math.abs(timestamp - start_time);
        hours = Math.floor(diffTime / (1000 * 60 * 60)).toString().padStart(2,"0");
        minutes = (Math.floor(diffTime / (1000 * 60))%60).toString().padStart(2,"0");
        seconds = (Math.floor(diffTime / (1000))%60).toString().padStart(2,"0");
    } else{
        let dt = new Date();
        timestamp += dt.getTimezoneOffset()*60*1000
        hours = Math.floor(timestamp / (1000 * 60 * 60)%24).toString().padStart(2,"0");
        minutes = (Math.floor(timestamp / (1000 * 60))%60).toString().padStart(2,"0");
        seconds = (Math.floor(timestamp / (1000))%60).toString().padStart(2,"0");
    }

    let clock = '<div class="clock">' +
        '<div>'+hours[0]+'</div>' +
        '<div>'+hours[1]+'</div>' +
        '<div class="separator">:</div>' +
        '<div>'+minutes[0]+'</div>' +
        '<div>'+minutes[1]+'</div>' +
        '<div class="separator">:</div>' +
        '<div>'+seconds[0]+'</div>' +
        '<div>'+seconds[1]+'</div>' +
        '</div>'
    return clock
}

function update_beerlines() {
    update_beerline(0)
    update_beerline(1)
}

function update_beerline(t) {
    let line = []
    let team
    if (t === -1){
        team = editing
        line = $("#blP").children().toArray();
    } else {
        team = teams[t]
        if (teams[t]["side"] === LEFT) {
            line = $("#blL").children().toArray();
            line = line.reverse()
        } else {
            line = $("#blR").children().toArray()
        }
    }
    for (let b = 0; b < team["beers"].length; b++ ){
        $(line[b]).children().hide()
        let beer = team["beers"][b]
        switch (beer["state"]) {
            case FALLEN:
                $(line[b]).find(".grass").show()
                break
            case UP:
                $(line[b]).find(".beer").show()
                break
            case FLIPPED:
                $(line[b]).find(".flip").show()
                break
        }
        if (beer["new"]){
            $(line[b]).find(".hit").show()

        }
        $(line[b]).find(".actor").show()
        let beer_text = ""
        if (beer["player"]){
            beer_text = get_player(beer["player"])
        }
        $(line[b]).find(".actor").text(beer_text)
    }
}