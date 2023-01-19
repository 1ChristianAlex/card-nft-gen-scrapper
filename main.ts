import AnimeListScrapper from './src/scrapper';

const main = async () => {
  // new AnimeListScrapper(10).run();
  console.log((await new AnimeListScrapper(20).getCurrentJsonFile()).length);
};

main();
