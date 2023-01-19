import { CheerioAPI, load } from 'cheerio';
import { CardModel } from './card.model';
import getPage from './getPage';
import { PageClassElements } from './pageElements';
import { writeFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, join } from 'path';
import AwsS3Service from './aws-s3.service';
import nodeFetch from 'node-fetch';

class AnimeListScrapper {
  constructor(private runs: number) {}

  async run() {
    for (let index = 0; index < this.runs; index++) {
      if (index !== 0) {
        await new Promise<void>((res) => setTimeout(() => res(), 60000));
      }
      console.log(`Running ${index}.`);

      this.load(index * 50);
    }
  }

  private async getPageToScrap(offset: number) {
    return await getPage(
      `https://myanimelist.net/character.php?limit=${offset + 1000}`
    );
  }

  private async getCheerioDoc(offset: number) {
    const pageHtml = await this.getPageToScrap(offset);
    return load(pageHtml);
  }

  private async load(offset: number) {
    const query = await this.getCheerioDoc(offset);
    const tableContent = query(`${PageClassElements.tableContent}`);

    const tableItems = query(tableContent).find(
      `${PageClassElements.itemList}`
    );

    const cards: CardModel[] = [];

    const promisesList = tableItems.map(async (_, item) => {
      const itemQuery = query(item);
      const findDescription = `${PageClassElements.characterTitle} .title > a`;

      const nameLink = itemQuery.find(
        `${PageClassElements.characterConteiner} ${PageClassElements.characterName} > a`
      );

      const characterPage = nameLink.attr('href');

      const thumbnails = await this.thumbnailScrapper(`${characterPage}/pics`);

      const cardCreated = new CardModel({
        name: nameLink.text(),
        description: itemQuery.find(findDescription).text(),
        likes: parseFloat(itemQuery.find(`${PageClassElements.likes}`).text()),
        rank: parseFloat(itemQuery.find(`${PageClassElements.rank}`).text()),
        thumbnails,
      });

      cards.push(cardCreated);
      console.log(`Card ${cardCreated.name} created`);

      return cardCreated;
    });

    for (const promise of promisesList) {
      await new Promise<void>((res) => setTimeout(() => res(), 30000));

      await promise;
    }

    return this.writeAppendJson(cards);
  }

  private async thumbnailScrapper(pageLink: string): Promise<string[]> {
    try {
      const imagePage = await getPage(pageLink);

      const queryPicsPage = load(imagePage);

      const thumbnails: string[] = [];

      queryPicsPage(
        `${PageClassElements.picPageContainer} [rel="gallery-character"] img`
      ).map((_, imageItem) => {
        thumbnails.push(queryPicsPage(imageItem).attr('data-src'));
      });

      const s3Bucket = new AwsS3Service();

      const thumbS3 = Promise.all(
        thumbnails.slice(0, 3).map(async (thumbItem) => {
          try {
            const imageFetchedResponse = await nodeFetch(thumbItem, {
              timeout: 5000,
            });

            if (!imageFetchedResponse.ok) {
              throw new Error('Fail to request image.');
            }

            console.log(`Uploading ${thumbItem} to S3`);

            return s3Bucket.uploadImageToBucket(
              Buffer.from(await imageFetchedResponse.arrayBuffer()),
              imageFetchedResponse.headers.get('content-type')
            );
          } catch (error) {
            console.log(`[ERROR_GET_THUMB] ${error.message} - ${thumbItem}`);

            return thumbItem;
          }
        })
      );

      return thumbS3;
    } catch (error) {
      console.log(
        `[ERROR_GET_THUMB] ${error.message} - ${error.response?.status}`
      );
    }
  }

  private async writeAppendJson(cards: CardModel[]) {
    try {
      const dirPath = resolve(join(process.cwd(), 'anime-characters.json'));
      console.log(dirPath);

      let cardList: CardModel[] = [];

      if (existsSync(dirPath)) {
        const jsonCard = await this.getCurrentJsonFile();

        if (Array.isArray(jsonCard)) {
          cardList = [...jsonCard];
        }

        console.log(`Merging JSON`);
      }

      cards.forEach((item) => {
        if (!cardList.find((itemFinded) => itemFinded.name === item.name)) {
          cardList.push(item);
        }
      });

      const cardListJson = JSON.stringify(cardList);

      console.log(`Writing JSON`);

      const data = new Uint8Array(Buffer.from(cardListJson));

      await writeFile(dirPath, data);
    } catch (error) {
      console.log(`[ERROR_WRITE_FILE] ${error.message}`);
    }
  }

  async getCurrentJsonFile() {
    const dirPath = resolve(join(process.cwd(), 'anime-characters.json'));

    const jsonCard = JSON.parse(
      await readFile(dirPath).then((file) => file.toString())
    ) as CardModel[];

    return jsonCard;
  }
}

export default AnimeListScrapper;
