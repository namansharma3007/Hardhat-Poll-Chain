import { ethers } from "hardhat";

const deployContract = async (): Promise<string> => {
  const MyContract = await ethers.getContractFactory("PollChain");
  const contract = await MyContract.deploy();
  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();
  return contractAddress;
};
deployContract()
  .then((data) => console.log("Contract address: ", data))
  .catch((error) => {
    console.error("Error while deploying smart contract", error);
    process.exitCode = 1;
  });

/*
npx hardhat compile
Copy paste the json file from artifacts folder
npx hardhat node
npx hardhat run scripts/deploy.ts --network localhost
*/
