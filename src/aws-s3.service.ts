import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

class AwsS3Service {
  private readonly REGION = 'sa-east-1';

  private readonly s3Client = new S3Client({ region: this.REGION });

  private readonly BUCKET_NAME = 'card-nft-bucket';

  async uploadImageToBucket(data: Buffer, mimetype: string): Promise<string> {
    const ext = mimetype.split('/').at(-1);
    const fileName = `${randomUUID()}.${ext}`;

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.BUCKET_NAME,
        Key: fileName,
        Body: data,
        ContentType: `image/${ext}`,
      })
    );

    const imageSrc = this.getImageFromAws(fileName);

    return imageSrc;
  }

  getImageFromAws(fileName: string): string {
    return `https://${this.BUCKET_NAME}.s3.${this.REGION}.amazonaws.com/${fileName}`;
  }
}

export default AwsS3Service;
