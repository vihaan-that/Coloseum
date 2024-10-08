const Tournament = require('../models/Tournament');
const Player = require('../models/Player');
const Organiser = require('../models/Organiser');
const team = require('../models/Team');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Team = require('../models/Team');

// Func: Follow Organisation
exports.followOrganiser = async (req, res) => {
    const { organiserId } = req.body;
    const { _id } = req.user; // Assuming _id is player's ID

    try {
        const player = await Player.findOne({ _id });
        if (!player) {
            return res.status(404).json({ message: 'Player not found' });
        }

        const organiser = await Organiser.findById(organiserId);
        if (!organiser) {
            return res.status(404).json({ message: 'Organiser not found' });
        }

        // Check if player is already following this organiser
        if (player.following.includes(organiserId)) {
            return res.status(202).json({ message: 'Player is already following this organiser', player, organiser });
        }

        // Add organiser to player's following list
        player.following.push(organiserId);
        await player.save();

        // Add player to organiser's followers list
        organiser.followers.push(player._id);
        await organiser.save();

        res.redirect('/api/player/homepage');
    } catch (error) {
        res.status(500).json({ error: 'Error following organiser' });
    }
};


// Func: Unfollow Organisation
exports.unfollowOrganiser = async (req, res) => {
    const { organiserId } = req.body;
    const { _id: playerId } = req.user; // Extract playerId from JWT token

    try {
        const player = await Player.findById(playerId);
        if (!player) {
            return res.status(404).json({ message: 'Player not found' });
        }

        const organiser = await Organiser.findById(organiserId);
        if (!organiser) {
            return res.status(404).json({ message: 'Organiser not found' });
        }

        // Check if player is following the organiser
        if (!player.following.includes(organiserId)) {
            return res.status(400).json({ message: 'Player is not following this organiser' });
        }

        // Remove organiser from player's following list
        player.following.pull(organiserId);
        await player.save();

        // Remove player from organiser's followers list
        organiser.followers.pull(playerId);
        await organiser.save();

        res.redirect('/api/player/homepage')
    } catch (error) {
        console.error('Error unfollowing organiser:', error);
        res.status(500).json({ error: 'Error unfollowing organiser', details: error.message });
    }
};

// Func: Search tournaments by tid or name
// searchController.js

exports.searchTournaments = async (req, res) => {
    try {
        const { searchTerm } = req.query || '';
        console.log('Search Term:', searchTerm); // Debugging line

        let tournaments = [];
        let joinedTournaments = [];

        if (searchTerm) {
            // Perform search only if a searchTerm is provided
            tournaments = await Tournament.find({
                $and: [
                    {
                        $or: [
                        { tid: new RegExp(searchTerm, 'i') },
                        { name: new RegExp(searchTerm, 'i') }
                        ]
                    },
                    { status: 'Approved' }
                ]   
            });
        }
        
        // Fetch joined tournaments if the user is logged in
        if (req.user && req.user._id) {
            const player = await Player.findById(req.user._id).populate('tournaments.tournament');
            if (player) {
                joinedTournaments = player.tournaments.map(t => t.tournament);
            }
        }

        console.log('Tournaments Found:', tournaments); // Debugging line
        console.log('Joined Tournaments:', joinedTournaments); // Debugging line

        // Render the search results page
        res.render('searchResults', {
            results: tournaments, // Pass the found tournaments
            searchTerm: searchTerm || '', // Pass the search term to the template
            joinedTournaments: joinedTournaments || [] // Pass the joined tournaments
        });
    } catch (error) {
        console.error('Error searching tournaments:', error); // Log the error
        res.status(500).render('error', { statusCode: '500', errorMessage: 'Error searching tournaments' });
    }
};





// Func: Join Tournament
exports.joinTournament = async (req, res) => {
    const { tournamentId } = req.body;
    const { _id } = req.user;

    try {
        const player = await Player.findOne({ _id }).populate('team');
        if (!player) {
            return res.status(404).render('error', { statusCode: '404', errorMessage: 'Player not found' });
        }

        if (!player.team) {
            return res.status(400).render('error', { statusCode: '400', errorMessage: 'Player must be part of a team' });
        }

        const tournament = await Tournament.findById(tournamentId);
        if (!tournament) {
            return res.status(404).render('error', { statusCode: '404', errorMessage: 'Tournament not found' });
        }

        if (tournament.teams.includes(player.team._id)) {
            return res.status(400).render('error', { statusCode: '400', errorMessage: 'Team is already registered for this tournament' });
        }

        tournament.teams.push(player.team._id);
        await tournament.save();

        player.tournaments.push({ tournament: tournament._id, won: false });
        await player.save();

        const pointsEntry = {
            ranking: tournament.pointsTable.length + 1, // Set ranking as the current length + 1
            teamName: player.team.name, // Get team name from the player
            totalPoints: 0, // Initialize total points to 0
        };

        // Add the points entry to the tournament's points table
        tournament.pointsTable.push(pointsEntry);

        // Save the tournament with the new entry
        await tournament.save();

        const joinedTournaments = await Tournament.find({ teams: player.team._id });

        // return res.render('homepage', {
        //     joinedTournaments,
        //     results: joinedTournaments, // Ensure 'results' is passed here
        //     searchTerm: null
        // });
        res.redirect('/api/player/homepage');
    } catch (error) {
        console.error("Error joining tournament:", error);
        return res.status(500).render('error', { statusCode: '500', errorMessage: 'Server error', error });
    }
};




// Update username
exports.updateUsername = async (req, res) => {
    const { username } = req.body;

    const { _id } = req.user;

    try {
        const player = await Player.findOne({ _id });
        if (!player) {
            return res.status(404).json({ message: 'Player not found' });
        }

        const existingPlayer = await Player.findOne({ username: username });
        if (existingPlayer) {
            return res.status(400).json({ message: 'Username already taken' });
        }

        player.username = username;
        await player.save();

        res.status(200).redirect('/dashboard');
    } catch (error) {
        console.error('Error updating username:', error);
        res.status(500).json({ error: 'Error updating username', details: error.message });
    }
};

// Update password
exports.updatePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const { _id } = req.user;

    console.log('Updating password for:', _id); 
    try {
        const player = await Player.findOne({ _id });
        if (!player) {
            return res.status(404).json({ message: 'Player not found' });
        }

        const isMatch = await bcrypt.compare(currentPassword, player.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Current password is incorrect' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        player.password = hashedPassword;
        await player.save();

        res.status(200).redirect('/dashboard');
    } catch (error) {
        console.error('Error updating password:', error);
        res.status(500).json({ error: 'Error updating password', details: error.message });
    }
};

// Update email
exports.updateEmail = async (req, res) => {
    const { email } = req.body; // Extract email from request body
    const { _id } = req.user;

    try {
        const player = await Player.findOne({ _id });
        if (!player) {
            return res.status(404).json({ message: 'Player not found' });
        }

        // Check if the email is already in use
        const existingPlayer = await Player.findOne({ email });
        if (existingPlayer) {
            return res.status(400).json({ message: 'Email already taken' });
        }

        player.email = email; // Update the player's email
        await player.save();

        res.status(200).redirect('/dashboard');
    } catch (error) {
        console.error('Error updating email:', error);
        res.status(500).json({ error: 'Error updating email', details: error.message });
    }
};


exports.updateProfile = async (req, res) => {
    const { username, email, currentPassword, newPassword } = req.body;
    const userId = req.user._id; // Ensure you have the user's ID from the JWT

    try {
        const player = await Player.findById(userId);
        
        
        if (!player) {
            return res.status(404).json({ message: 'User not found' });
        }

        // // Log to check the incoming data
        // console.log('Incoming data:', req.body);
        // console.log('Fetched Player:', player);

        console.log(currentPassword);

        // Check if currentPassword is provided
        if (!currentPassword) {
            return res.status(400).json({ message: 'Current password is required' });
        }

        // Compare the provided current password with the stored hashed password
        const match = await bcrypt.compare(currentPassword, player.password);
        if (!match) {
            return res.status(401).json({ message: 'Current password is incorrect' });
        }

        // Update username and email
        player.username = username;
        player.email = email;

        // If a new password is provided, hash it and update
        if (newPassword) {
            player.password = await bcrypt.hash(newPassword, 10);
        }

        // Save the updated player information
        await player.save();

        res.status(200).json({ message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ message: 'Server error' });
    }
};





// Fetch number of tournaments played by the player
exports.getTournamentsPlayed = async (req, res) => {
    const { _id } = req.user;
    try {
        const player = await Player.findById( { _id } );

        console.log('Player ID from token:', { _id });

        if (!player) {
            return res.status(404).json({ message: 'Player not found' });
        }

        const tournamentsPlayed = player.tournaments.length;
        res.status(200).json({ tournamentsPlayed });
    } catch (error) {
        console.error('Error fetching tournaments played:', error);
        res.status(500).json({ error: 'Error fetching tournaments played' });
    }
};

// Fetch number of tournaments won by the player
// backend/controllers/playerController.js
exports.getTournamentsWon = async (req, res) => {
    const { _id } = req.user;

    try {
        const player = await Player.findOne({ _id });
        if (!player) {
            return res.status(404).json({ message: 'Player not found' });
        }

        const tournamentsWon = player.tournaments.filter(t => t.won).length;
        res.status(200).json({ tournamentsWon });
    } catch (error) {
        console.error('Error fetching tournaments won:', error);
        res.status(500).json({ error: 'Error fetching tournaments won' });
    }
};

// Fetch player ranking based on the number of tournaments played
exports.getPlayerRanking = async (req, res) => {
    const { _id } = req.user;

    try {
        const player = await Player.findOne({ _id });
        if (!player) {
            return res.status(404).json({ message: 'Player not found' });
        }

        const players = await Player.find();
        const playerRanking = players.sort((a, b) => b.tournaments.length - a.tournaments.length)
                                     .findIndex(p => p._id.toString() === _id.toString()) + 1;

        res.status(200).json({ playerRanking });
    } catch (error) {
        console.error('Error fetching player ranking:', error);
        res.status(500).json({ error: 'Error fetching player ranking' });
    }
};

exports.getFollowedOrganisers = async (req, res) => {
    const { _id } = req.user;
    try {
        // Find the player by their ID
        const player = await Player.findById(_id).populate('following');

        console.log('Player ID from token:', _id);

        if (!player) {
            return res.status(404).json({ message: 'Player not found' });
        }

        const followingOrganisers = player.following;

        res.status(200).json({ followingOrganisers });
    } catch (error) {
        console.error('Error fetching organisers followed:', error);
        res.status(500).json({ error: 'Error fetching organisers followed' });
    }
};


// Example route for search results rendering the homepage
exports.getHomePage = async (req, res) => {
    try {
        const tournaments = await Tournament.find().catch(err => {
            console.error('Error fetching tournaments:', err);
            return [];
        });

        const players = await Player.find().catch(err => {
            console.error('Error fetching players:', err);
            return [];
        });

        const organisers = await Organiser.find().catch(err => {
            console.error('Error fetching organisers:', err);
            return [];
        });

        let followedOrganisers = [];
        let joinedTournaments = [];

        // Ensure the playerName is extracted if user is logged in
        const playerName = req.user?.username || 'Guest';
        
        if (req.user && req.user._id) {
            const { _id } = req.user;

            const player = await Player.findById(_id)
                .populate({
                    path: 'following',
                    model: 'Organiser',
                    populate: {
                        path: 'tournaments',
                        model: 'Tournament'
                    }
                })
                .populate('team')
                .catch(err => {
                    console.error('Error fetching player data:', err);
                    return null;
                });

            if (player) {
                followedOrganisers = player.following || [];

                // Fetch tournaments for the player's team
                const team = player.team;
                if (team) {
                    joinedTournaments = await Tournament.find({ teams: team._id })
                        .catch(err => {
                            console.error('Error fetching tournaments for team:', err);
                            return [];
                        });
                }
            }
        }

        res.render('homepage', {
            results: tournaments || [],
            players: players || [],
            searchTerm: '',
            organisers: organisers || [],
            followedOrganisers,
            joinedTournaments,
            playerName
        });
    } catch (error) {
        console.error('Error in getHomePage:', error);
        res.status(500).render('error', {
            statusCode: '500',
            errorMessage: 'Error fetching data for the homepage'
        });
    }
};





exports.getTournamentPointsTable = async (req, res) => {
    const { tournamentId } = req.params;

    try {
        const tournament = await Tournament.findById(tournamentId).select('name pointsTable');
        if (!tournament) {
            return res.status(404).json({ message: 'Tournament not found' });
        }   
        
        res.render('tournamentDetails', { pointsTable: tournament.pointsTable, tournamentName: tournament.name });
    } catch (error) {
        return res.status(500).json({ message: 'Internal server error', error });
    }
};




exports.getDashboard = async (req, res) => {
    const _id = req.user._id;
    const currentDate = new Date();
    try {
        const player = await Player.findById(_id).populate('tournaments.tournament');
        if (!player) {
            return res.status(404).json({ message: 'Player not found' });
        }

        const tournamentsWon = player.tournaments.filter(t => t.won).length;
        const tournamentsPlayed = player.tournaments.length;

        let winPercentage = 0;
        if (tournamentsPlayed != 0) {
            winPercentage = (tournamentsWon / tournamentsPlayed) * 100;
        }

        const ongoingTournaments = player.tournaments.filter(t => {
            const tournament = t.tournament;
            return tournament && currentDate >= tournament.startDate && currentDate <= tournament.endDate;
        }).length;

        const teamId = player.team; 
        const team = await Team.findById(teamId); 

        res.render('dashboard', {
            player: {
                username: player.username,
                email: player.email,
                globalRank: player.globalRank || 'Unranked',
                tournamentsWon: tournamentsWon || 0,
                tournamentsPlayed: tournamentsPlayed || 0,
                noOfOrgsFollowing: player.following.length || 0,
                team,
                winPercentage: winPercentage.toFixed(2),
                ongoingTournaments,
            }
        });

    } catch (error) {
        console.error("Error fetching dashboard:", error.message);  // Log the error message
        res.status(500).json({ error: 'Error fetching dashboard', details: error.message });
    }
};