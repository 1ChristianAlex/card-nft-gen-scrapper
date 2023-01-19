import nodeFetch from 'node-fetch';

const getPage = async (url: string) => {
  console.log(`Getting page ${url} `);
  return nodeFetch(url).then((response) => response.text());
};

export default getPage;
