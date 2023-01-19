class CardModel {
  constructor(card: CardModel) {
    Object.assign(this, card);
  }

  public name: string;

  public description: string;

  public likes: number;
  public rank: number;

  public thumbnails: string[];
}

export { CardModel };
