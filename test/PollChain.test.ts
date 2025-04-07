import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { PollChain } from "../typechain-types"; // Adjust path based on your project structure

// Sample poll data for testing
const newPolls = [
  {
    title: "Favorite Color Poll",
    question: "What is your favorite color?",
    options: ["Red", "Green", "Blue"],
    isMultipleChoice: false,
  },
  {
    title: "Favorite Sports Poll",
    question: "Name your favorite sports",
    options: ["Soccer", "Equestrian", "Basketball", "Tennis"],
    isMultipleChoice: true,
  },
  {
    title: "Favorite Programming Language Poll",
    question: "What is your favorite programming language?",
    options: ["Python", "JavaScript", "Java", "C++"],
    isMultipleChoice: false,
  },
];

// Test suite for PollChain contract
describe("PollChain", () => {
  let pollingApp: PollChain;
  let owner: SignerWithAddress;
  let voter1: SignerWithAddress;
  let voter2: SignerWithAddress;
  let voter3: SignerWithAddress;

  // Setup before all tests
  before(async () => {
    [owner, voter1, voter2, voter3] = await ethers.getSigners();
    const PollingAppFactory = await ethers.getContractFactory("PollChain", owner);
    pollingApp = await PollingAppFactory.deploy();
  });

  describe("Poll Creation", () => {
    it("should create a single-choice poll with active status as true", async () => {
      const tx = await pollingApp
        .connect(voter1)
        .createPoll(
          newPolls[0].title,
          newPolls[0].question,
          newPolls[0].options,
          newPolls[0].isMultipleChoice
        );
      await expect(tx)
        .to.emit(pollingApp, "PollCreated")
        .withArgs(
          0,
          voter1.address,
          newPolls[0].title,
          newPolls[0].question,
          newPolls[0].options,
          newPolls[0].isMultipleChoice,
          (await ethers.provider.getBlock(tx.blockNumber ?? 0))?.timestamp
        );

      const [id, creator, title, question, optionTexts, optionVotes, isMultipleChoice, voterCount, active, createdAt] =
        await pollingApp.getPoll(0);
      expect(id).to.equal(0);
      expect(creator).to.equal(voter1.address);
      expect(title).to.equal(newPolls[0].title);
      expect(question).to.equal(newPolls[0].question);
      expect(optionTexts).to.deep.equal(newPolls[0].options);
      expect(optionVotes).to.deep.equal([0, 0, 0]);
      expect(isMultipleChoice).to.equal(newPolls[0].isMultipleChoice);
      expect(voterCount).to.equal(0);
      expect(active).to.be.true;
      expect(createdAt).to.equal((await ethers.provider.getBlock(tx.blockNumber ?? 0))?.timestamp);
    });

    it("should create a multiple-choice poll with active status", async () => {
      const tx = await pollingApp
        .connect(owner)
        .createPoll(
          newPolls[1].title,
          newPolls[1].question,
          newPolls[1].options,
          newPolls[1].isMultipleChoice
        );
      await expect(tx)
        .to.emit(pollingApp, "PollCreated")
        .withArgs(
          1,
          owner.address,
          newPolls[1].title,
          newPolls[1].question,
          newPolls[1].options,
          newPolls[1].isMultipleChoice,
          (await ethers.provider.getBlock(tx.blockNumber ?? 0))?.timestamp
        );

      const [id, creator, title, question, optionTexts, optionVotes, isMultipleChoice, voterCount, active, createdAt] =
        await pollingApp.getPoll(1);
      expect(id).to.equal(1);
      expect(creator).to.equal(owner.address);
      expect(title).to.equal(newPolls[1].title);
      expect(question).to.equal(newPolls[1].question);
      expect(optionTexts).to.deep.equal(newPolls[1].options);
      expect(optionVotes).to.deep.equal([0, 0, 0, 0]);
      expect(isMultipleChoice).to.equal(newPolls[1].isMultipleChoice);
      expect(voterCount).to.equal(0);
      expect(active).to.be.true;
      expect(createdAt).to.equal((await ethers.provider.getBlock(tx.blockNumber ?? 0))?.timestamp);
    });

    it("should revert when creating a poll with no options", async () => {
      await expect(pollingApp.createPoll("Invalid Title", "Invalid poll", [], false)).to.be.revertedWith(
        "Must have at least one option"
      );
    });

    it("should track user polls correctly", async () => {
      const userPollsBefore = await pollingApp.connect(voter1).getUserPolls();
      expect(userPollsBefore).to.deep.equal([0]);

      await pollingApp
        .connect(voter1)
        .createPoll(
          newPolls[2].title,
          newPolls[2].question,
          newPolls[2].options,
          newPolls[2].isMultipleChoice
        );
      const userPollsAfter = await pollingApp.connect(voter1).getUserPolls();
      expect(userPollsAfter).to.deep.equal([0, 2]);
    });
  });

  describe("Poll Retrieval", () => {
    it("should get poll details for poll 0", async () => {
      const [id, creator, title, question, optionTexts, optionVotes, isMultipleChoice, voterCount, active, createdAt] =
        await pollingApp.getPoll(0);
      expect(id).to.equal(0);
      expect(creator).to.equal(voter1.address);
      expect(title).to.equal(newPolls[0].title);
      expect(question).to.equal(newPolls[0].question);
      expect(optionTexts).to.deep.equal(newPolls[0].options);
      expect(optionVotes).to.deep.equal([0, 0, 0]);
      expect(isMultipleChoice).to.equal(newPolls[0].isMultipleChoice);
      expect(voterCount).to.equal(0);
      expect(active).to.be.true;
    });

    it("should revert when getting a non-existent poll", async () => {
      await expect(pollingApp.getPoll(999)).to.be.revertedWith("Poll does not exist");
    });
  });

  describe("Voting", () => {
    it("should allow voting in an active single-choice poll", async () => {
      const pollId = 0;
      const chosenOption = [0]; // Choose "Red"
      const tx = await pollingApp.connect(voter2).vote(pollId, chosenOption);
      await expect(tx)
        .to.emit(pollingApp, "Voted")
        .withArgs(pollId, voter2.address, chosenOption);

      const [_, __, ___, ____, optionVotes, _____, voterCount] = await pollingApp.getPoll(pollId);
      expect(optionVotes[0]).to.equal(1);
      expect(optionVotes[1]).to.equal(0);
      expect(optionVotes[2]).to.equal(0);
      expect(voterCount).to.equal(1);
    });

    it("should allow voting in an active multiple-choice poll", async () => {
      const pollId = 1;
      const chosenOptions = [0, 2]; // Choose "Soccer" and "Basketball"
      const tx = await pollingApp.connect(voter3).vote(pollId, chosenOptions);
      await expect(tx)
        .to.emit(pollingApp, "Voted")
        .withArgs(pollId, voter3.address, chosenOptions);

      const [_, __, ___, ____, optionVotes, _____, voterCount] = await pollingApp.getPoll(pollId);
      expect(optionVotes[0]).to.equal(1);
      expect(optionVotes[1]).to.equal(0);
      expect(optionVotes[2]).to.equal(1);
      expect(optionVotes[3]).to.equal(0);
      expect(voterCount).to.equal(1);
    });

    it("should prevent voting again in single-choice poll", async () => {
      const pollId = 0;
      await expect(pollingApp.connect(voter2).vote(pollId, [1])).to.be.revertedWith("Already voted");
    });

    it("should prevent voting again in multiple-choice poll", async () => {
      const pollId = 1;
      await expect(pollingApp.connect(voter3).vote(pollId, [1])).to.be.revertedWith("Already voted");
    });

    it("should correctly track who has voted", async () => {
      expect(await pollingApp.hasVotedInPoll(0, voter2.address)).to.be.true;
      expect(await pollingApp.hasVotedInPoll(1, voter2.address)).to.be.false;
      expect(await pollingApp.hasVotedInPoll(0, voter3.address)).to.be.false;
      expect(await pollingApp.hasVotedInPoll(1, voter3.address)).to.be.true;
    });

    it("should update pollsVotedCount correctly", async () => {
      expect(await pollingApp.pollsVotedCount(voter2.address)).to.equal(1);
      expect(await pollingApp.pollsVotedCount(voter3.address)).to.equal(1);
    });
  });

  describe("Poll Status Toggle", () => {
    it("should allow creator to deactivate a poll", async () => {
      const pollId = 0;
      const tx = await pollingApp.connect(voter1).togglePollStatus(pollId);
      await expect(tx).to.emit(pollingApp, "PollStatusToggled").withArgs(pollId, false);

      const [_, __, ___, ____, _____, ______, _______ , active] = await pollingApp.getPoll(pollId);
      expect(active).to.be.false;
    });

    it("should allow creator to reactivate a poll", async () => {
      const pollId = 0;
      const tx = await pollingApp.connect(voter1).togglePollStatus(pollId);
      await expect(tx).to.emit(pollingApp, "PollStatusToggled").withArgs(pollId, true);

      const [_, __, ___, ____, _____, ______, _______ , active] = await pollingApp.getPoll(pollId);
      expect(active).to.be.true;
    });

    it("should prevent non-creator from toggling poll status", async () => {
      const pollId = 0;
      await expect(pollingApp.connect(owner).togglePollStatus(pollId)).to.be.revertedWith(
        "Only creator can toggle status"
      );
    });
  });

  describe("Voting in Inactive Poll", () => {
    it("should prevent voting in an inactive poll", async () => {
      const pollId = 0;
      await pollingApp.connect(voter1).togglePollStatus(pollId); // Deactivate
      await expect(pollingApp.connect(voter3).vote(pollId, [0])).to.be.revertedWith("Poll is not active");
    });

    it("should allow voting after reactivating the poll", async () => {
      const pollId = 0;
      await pollingApp.connect(voter1).togglePollStatus(pollId); // Reactivate
      const tx = await pollingApp.connect(voter3).vote(pollId, [1]); // Choose "Green"
      await expect(tx)
        .to.emit(pollingApp, "Voted")
        .withArgs(pollId, voter3.address, [1]);

      const [_, __, ___, ____, optionVotes, _____, voterCount] = await pollingApp.getPoll(pollId);
      expect(optionVotes[0]).to.equal(1); // voter2's vote
      expect(optionVotes[1]).to.equal(1); // voter3's vote
      expect(optionVotes[2]).to.equal(0);
      expect(voterCount).to.equal(2);
    });
  });

  describe("Poll Deletion", () => {
    it("should allow creator to delete a poll", async () => {
      const pollId = 1;
      const tx = await pollingApp.connect(owner).deletePoll(pollId);
      await expect(tx).to.emit(pollingApp, "PollDeleted").withArgs(pollId);
      await expect(pollingApp.getPoll(pollId)).to.be.revertedWith("Poll does not exist");
    });

    it("should prevent non-creator from deleting a poll", async () => {
      const pollId = 0;
      await expect(pollingApp.connect(owner).deletePoll(pollId)).to.be.revertedWith("Only creator can delete");
    });
  });

  describe("Edge Cases", () => {
    it("should revert when voting with an invalid option", async () => {
      const pollId = 0;
      await expect(pollingApp.connect(voter1).vote(pollId, [3])).to.be.revertedWith("Invalid option");
    });

    it("should revert when voting with duplicate options in multiple-choice", async () => {
      const tx = await pollingApp
        .connect(owner)
        .createPoll(
          newPolls[1].title,
          newPolls[1].question,
          newPolls[1].options,
          newPolls[1].isMultipleChoice
        );
      const pollId = 3; // After polls 0, 1, 2
      await expect(pollingApp.connect(voter1).vote(pollId, [0, 0])).to.be.revertedWith("Duplicate options");
    });

    it("should revert when voting with multiple options in single-choice poll", async () => {
      const pollId = 0;
      await expect(pollingApp.connect(voter1).vote(pollId, [0, 1])).to.be.revertedWith(
        "Must choose exactly one option"
      );
    });

    it("should revert when voting with no options in multiple-choice poll", async () => {
      const pollId = 3;
      await expect(pollingApp.connect(voter2).vote(pollId, [])).to.be.revertedWith(
        "Must choose at least one option"
      );
    });
  });
});