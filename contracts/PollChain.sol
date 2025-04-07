// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PollChain {
    struct Poll {
        uint256 id;
        address creator;
        string title;
        string question;
        Option[] options;
        uint256 voterCount;
        uint256 deadline; // In milliseconds
        uint256 createdAt; // In seconds
        mapping(address => bool) hasVoted;
    }

    struct Option {
        uint256 id;
        string option;
        uint256 votes;
    }

    struct PollDetails {
        uint256 id;
        address creator;
        string title;
        string question;
        string[] optionTexts;
        uint256[] optionVotes;
        uint256 voterCount;
        uint256 deadline; // In milliseconds
        uint256 createdAt; // In seconds
        bool hasAlreadyVoted;
    }

    uint256 private pollCount;
    uint256 private votesCasted;
    mapping(uint256 => Poll) public polls;
    mapping(address => uint256) public pollsVotedCount;
    mapping(address => uint256[]) public userPolls;

    event PollCreated(uint256 indexed pollId);
    event PollDeleted(uint256 indexed pollId);
    event Voted(uint256 indexed pollId);

    modifier pollExists(uint256 pollId) {
        require(polls[pollId].creator != address(0), "Poll does not exist");
        _;
    }

    function createPoll(
        string memory title,
        string memory question,
        string[] memory optionTexts,
        uint256 deadline
    ) external {
        require(optionTexts.length > 1, "Must have at least two options");
        require(
            deadline > block.timestamp * 1000,
            "Deadline must be in the future"
        );

        Poll storage poll = polls[pollCount];
        poll.id = pollCount;
        poll.title = title;
        poll.creator = msg.sender;
        poll.question = question;
        for (uint256 i = 0; i < optionTexts.length; i++) {
            poll.options.push(Option(i, optionTexts[i], 0));
        }
        poll.voterCount = 0;
        poll.deadline = deadline; // Stored in milliseconds
        poll.createdAt = block.timestamp; // Stored in seconds

        userPolls[msg.sender].push(pollCount);

        emit PollCreated(pollCount);

        pollCount++;
    }

    function vote(
        uint256 pollId,
        uint256 chosenOption
    ) external pollExists(pollId) {
        Poll storage poll = polls[pollId];
        require(
            block.timestamp * 1000 < poll.deadline,
            "Voting period has ended"
        );
        require(!poll.hasVoted[msg.sender], "Already voted");
        require(chosenOption < poll.options.length, "Invalid option");

        poll.options[chosenOption].votes++;
        poll.hasVoted[msg.sender] = true;
        poll.voterCount++;
        pollsVotedCount[msg.sender]++;
        votesCasted++;
        emit Voted(pollId);
    }

    function deletePoll(uint256 pollId) external pollExists(pollId) {
        Poll storage poll = polls[pollId];
        require(poll.creator == msg.sender, "Only creator can delete");

        delete polls[pollId];

        uint256[] storage userP = userPolls[msg.sender];
        for (uint256 i = 0; i < userP.length; i++) {
            if (userP[i] == pollId) {
                userP[i] = userP[userP.length - 1];
                userP.pop();
                break;
            }
        }

        emit PollDeleted(pollId);
    }

    function getPoll(
        uint256 pollId
    ) public view pollExists(pollId) returns (PollDetails memory) {
        Poll storage poll = polls[pollId];
        string[] memory texts = new string[](poll.options.length);
        uint256[] memory votes = new uint256[](poll.options.length);

        for (uint256 i = 0; i < poll.options.length; i++) {
            texts[i] = poll.options[i].option;
            votes[i] = poll.options[i].votes;
        }

        bool hasAlreadyVoted = poll.hasVoted[msg.sender];

        return
            PollDetails(
                poll.id,
                poll.creator,
                poll.title,
                poll.question,
                texts,
                votes,
                poll.voterCount,
                poll.deadline,
                poll.createdAt,
                hasAlreadyVoted
            );
    }

    function getAllPolls(
        uint256 start,
        uint256 limit
    ) external view returns (PollDetails[] memory) {
        require(pollCount > 0, "No polls created yet");
        require(start < pollCount, "Start index out of bounds");
        uint256 end = start + limit;
        if (end > pollCount) {
            end = pollCount;
        }

        uint256 activeCount = 0;
        for (uint256 i = start; i < end; i++) {
            if (polls[i].creator != address(0)) {
                activeCount++;
            }
        }

        PollDetails[] memory allPolls = new PollDetails[](activeCount);
        uint256 index = 0;
        for (uint256 i = start; i < end; i++) {
            if (polls[i].creator != address(0)) {
                allPolls[index] = getPoll(i);
                index++;
            }
        }

        return allPolls;
    }

    function hasVotedInPoll(
        uint256 pollId
    ) internal view pollExists(pollId) returns (bool) {
        Poll storage poll = polls[pollId];
        return poll.hasVoted[msg.sender];
    }

    function getUserPolls() external view returns (PollDetails[] memory) {
        uint256[] memory userP = userPolls[msg.sender];

        if (userP.length == 0) {
            revert("No polls created by this user");
        }
        uint256 activeCount = 0;
        for (uint256 i = 0; i < userP.length; i++) {
            uint256 pollId = userP[i];
            if (polls[pollId].creator != address(0)) {
                activeCount++;
            }
        }
        PollDetails[] memory result = new PollDetails[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < userP.length; i++) {
            uint256 pollId = userP[i];
            if (polls[pollId].creator != address(0)) {
                result[index] = getPoll(pollId);
                index++;
            }
        }

        return result;
    }

    function getActivePollsCount() external view returns (uint256) {
        uint256 activeCount = 0;
        for (uint256 i = 0; i < pollCount; i++) {
            if (
                polls[i].creator != address(0) &&
                polls[i].deadline > block.timestamp * 1000
            ) {
                activeCount++;
            }
        }
        return activeCount;
    }

    function getAllPollsCount() external view returns (uint256) {
        return pollCount;
    }

    function getVotesCasted() external view returns (uint256) {
        return votesCasted;
    }

    function getPollsVotedByUser() external view returns (uint256) {
        return pollsVotedCount[msg.sender];
    }

    function getPollsViaAddress(
        address _address
    ) external view returns (PollDetails[] memory) {
        uint256[] memory userP = userPolls[_address];

        if (userP.length == 0) {
            revert("No polls created by this user");
        }
        uint256 activeCount = 0;
        for (uint256 i = 0; i < userP.length; i++) {
            uint256 pollId = userP[i];
            if (polls[pollId].creator != address(0)) {
                activeCount++;
            }
        }
        PollDetails[] memory result = new PollDetails[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < userP.length; i++) {
            uint256 pollId = userP[i];
            if (polls[pollId].creator != address(0)) {
                result[index] = getPoll(pollId);
                index++;
            }
        }

        return result;
    }
}
